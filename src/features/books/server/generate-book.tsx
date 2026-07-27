import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { v4 as uuidv4 } from "uuid";
import { constructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/db";
import { uploadBufferToR2 } from "@/lib/upload-buffer-to-r2";
import {
  buildDefaultClosingLayout,
  buildDefaultCoverLayout,
  resolveImageKey,
  type CoverBackground,
  type CoverElement,
} from "../lib/cover-layout";
import {
  DEFAULT_BACKDROP_COLOR,
  DEFAULT_PHOTO_ADJUSTMENT,
  buildPhotoSlotMap,
  getSlotAspectRatio,
  type PhotoAdjustment,
  type PhotoSlotShape,
} from "../lib/photo-adjustment";
import {
  BookDocument,
  type BookDocumentData,
  type PhotoBackdropSource,
  type PhotoSource,
} from "../pdf/book-document";
import { composeFocusPhotoForPdf, cropPhotoForPdf } from "./crop-photo";

// `imageKey` de cada elemento tipo "image" vira URL completa — book-document.tsx
// só sabe renderizar, não resolve keys do R2.
function resolveLayoutImages(
  layout: unknown,
  logos?: { organization?: string | null; supplier?: string | null },
): CoverElement[] | null {
  if (!Array.isArray(layout)) return null;
  return (layout as CoverElement[]).map((element) => {
    if (element.type !== "image") return element;
    const key = resolveImageKey(element, logos);
    return key
      ? { ...element, imageKey: constructUrl(key) }
      : { ...element, imageKey: "" };
  });
}

// `imageKey` do fundo vira URL completa, igual resolveLayoutImages faz pros
// elementos — book-document.tsx só sabe renderizar, não resolve keys do R2.
function readBackground(value: unknown): CoverBackground | null {
  if (!value || typeof value !== "object") return null;
  const background = value as CoverBackground;
  return {
    ...background,
    imageKey: background.imageKey ? constructUrl(background.imageKey) : null,
  };
}

type PhotoAdjustmentMap = Record<string, PhotoAdjustment>;

function readPhotoAdjustments(value: unknown): PhotoAdjustmentMap {
  if (!value || typeof value !== "object") return {};
  return value as PhotoAdjustmentMap;
}

// Foto sem ajuste salvo = URL direta (react-pdf baixa e faz "cover"
// sozinho, igual sempre foi). Com ajuste, corta com sharp reproduzindo o
// mesmo pan/zoom calculado no editor antes de embutir no PDF.
async function resolvePhotoSources(
  photos: string[],
  adjustments: PhotoAdjustmentMap,
  pattern: "PATTERN_1" | "PATTERN_2" | "PATTERN_3" | "PATTERN_4" | null,
  photoSlots: Map<number, PhotoSlotShape> | null,
): Promise<PhotoSource[]> {
  return Promise.all(
    photos.map(async (key, index) => {
      const adjustment = adjustments[key];
      if (!adjustment) return constructUrl(key);

      let aspectRatio: number;
      if (photoSlots) {
        const slot = photoSlots.get(index);
        if (!slot) return constructUrl(key);
        aspectRatio = slot.aspectRatio;
        // Foco seletivo compõe a foto inteira desfocada + o recorte nítido numa
        // imagem só; vale mesmo em slot "caber inteira", que aí passa a
        // preencher o espaço com a versão desfocada.
        if (adjustment.backdrop === "blur") {
          try {
            const buffer = await composeFocusPhotoForPdf(
              constructUrl(key),
              adjustment,
              aspectRatio,
            );
            return { data: buffer, format: "jpg" as const };
          } catch {
            return constructUrl(key);
          }
        }
        // "Caber inteira" sem foco precisa da imagem completa — cortar aqui
        // contradiria a opção e comeria parte da foto.
        if (slot.objectFit === "contain") return constructUrl(key);
      } else {
        aspectRatio = getSlotAspectRatio(pattern, index, photos.length);
      }

      try {
        const buffer = await cropPhotoForPdf(
          constructUrl(key),
          adjustment ?? DEFAULT_PHOTO_ADJUSTMENT,
          aspectRatio,
        );
        return { data: buffer, format: "jpg" as const };
      } catch {
        // Se o corte falhar por qualquer motivo (ex.: imagem inacessível),
        // cai pra URL original em vez de quebrar a geração do PDF inteiro.
        return constructUrl(key);
      }
    }),
  );
}

// Cor sólida atrás de uma foto "caber inteira". O desfoque com foco seletivo
// não passa por aqui: ele é composto direto na imagem do slot
// (composeFocusPhotoForPdf), então só a cor sobra pra este caminho.
function resolvePhotoBackdrops(
  photos: string[],
  adjustments: PhotoAdjustmentMap,
  photoSlots: Map<number, PhotoSlotShape> | null,
): Array<PhotoBackdropSource | undefined> {
  return photos.map((key, index) => {
    if (adjustments[key]?.backdrop !== "color") return undefined;
    const slot = photoSlots?.get(index);
    if (slot && slot.objectFit !== "contain") return undefined;
    return {
      type: "color" as const,
      color: adjustments[key]?.backdropColor ?? DEFAULT_BACKDROP_COLOR,
    };
  });
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export async function generateBook(bookId: string): Promise<string> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      organization: { select: { logo: true, name: true } },
      supplier: {
        select: {
          name: true,
          logo: true,
          brands: { where: { isActive: true }, select: { logo: true } },
        },
      },
      items: {
        orderBy: { order: "asc" },
        include: {
          pdvPhoto: {
            include: {
              store: { select: { name: true, managerName: true } },
              mediaType: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!book) throw new Error("Book não encontrado");

  // O editor mostra o padrão da indústria (ou o da organização) quando o book
  // ainda não tem layout próprio, e só grava depois de uma edição de verdade.
  // Sem repetir a mesma cascata aqui, o PDF sairia com a capa fixa antiga —
  // diferente da que o usuário acabou de ver na tela.
  const template =
    book.coverLayout && book.closingLayout
      ? null
      : await prisma.bookTemplate.findFirst({
          where: {
            organizationId: book.organizationId,
            OR: book.supplierId
              ? [{ supplierId: book.supplierId }, { supplierId: null }]
              : [{ supplierId: null }],
          },
          orderBy: [{ supplierId: "desc" }, { isDefault: "desc" }],
        });

  const capa =
    book.coverLayout ?? template?.coverLayout ?? buildDefaultCoverLayout();
  const paginaFinal =
    book.closingLayout ??
    template?.closingLayout ??
    buildDefaultClosingLayout();
  const fundoCapa = book.coverBackground ?? template?.coverBackground ?? null;
  const fundoFinal =
    book.closingBackground ?? template?.closingBackground ?? null;

  const distributorKey = book.distributorLogo ?? book.organization.logo;
  const logos = {
    organization: distributorKey,
    supplier: book.supplier?.logo ?? null,
  };
  const pageLayout = resolveLayoutImages(book.pageLayout, logos);
  const bookPhotoSlots = buildPhotoSlotMap(pageLayout);

  const items = await Promise.all(
    book.items.map(async (item) => {
      // Layout próprio da página vence o do book, e os slots de foto precisam
      // vir do layout que de fato será renderizado — senão o corte sai numa
      // proporção e a foto é encaixada em outra.
      const itemPageLayout = resolveLayoutImages(item.pageLayout, logos);
      const photoSlots = itemPageLayout
        ? buildPhotoSlotMap(itemPageLayout)
        : bookPhotoSlots;

      return {
        pageLayout: itemPageLayout,
        pageBackground: itemPageLayout
          ? readBackground(item.pageBackground)
          : null,
        storeName: item.pdvPhoto.store.name,
        // Mesmo fallback do book.getOne — o que o card mostra é o que sai no PDF.
        storeManager:
          item.pdvPhoto.managerName ?? item.pdvPhoto.store.managerName,
        coordinatorName: item.pdvPhoto.coordinatorName,
        consultantName: item.pdvPhoto.consultantName,
        responsibleCompany: item.pdvPhoto.responsibleCompany,
        mediaTypeName: item.pdvPhoto.mediaType?.name ?? null,
        section: item.pdvPhoto.section,
        code: item.pdvPhoto.code,
        actionValueLabel: item.pdvPhoto.actionValue
          ? currency.format(Number(item.pdvPhoto.actionValue))
          : null,
        photoSources: await resolvePhotoSources(
          item.pdvPhoto.photos,
          readPhotoAdjustments(item.pdvPhoto.photoAdjustments),
          item.pdvPhoto.photoLayout,
          photoSlots,
        ),
        photoBackdrops: resolvePhotoBackdrops(
          item.pdvPhoto.photos,
          readPhotoAdjustments(item.pdvPhoto.photoAdjustments),
          photoSlots,
        ),
        photoLayoutPattern: item.pdvPhoto.photoLayout,
      };
    }),
  );

  const data: BookDocumentData = {
    bookName: book.name,
    periodLabel: `${MONTHS[book.periodMonth - 1] ?? ""} / ${book.periodYear}`,
    distributorLogoUrl: distributorKey ? constructUrl(distributorKey) : null,
    industryLogoUrl: book.supplier?.logo
      ? constructUrl(book.supplier.logo)
      : null,
    industryName: book.supplier?.name ?? null,
    brandLogoUrls: (book.supplier?.brands ?? [])
      .map((brand) => brand.logo)
      .filter((logo): logo is string => !!logo)
      .map(constructUrl),
    items,
    coverLayout: resolveLayoutImages(capa, logos),
    closingLayout: resolveLayoutImages(paginaFinal, logos),
    pageLayout,
    coverBackground: readBackground(fundoCapa),
    closingBackground: readBackground(fundoFinal),
    pageBackground: readBackground(book.pageBackground),
  };

  const buffer = await renderToBuffer(<BookDocument data={data} />);
  const key = `books/${bookId}-${uuidv4()}.pdf`;
  await uploadBufferToR2(key, Buffer.from(buffer), "application/pdf");

  await prisma.book.update({
    where: { id: bookId },
    data: { pdfKey: key, status: "READY", generatedAt: new Date() },
  });

  return key;
}
