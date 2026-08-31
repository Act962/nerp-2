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
import {
  composeFocusPhotoForPdf,
  cropPhotoForPdf,
  reencodeToJpeg,
} from "./crop-photo";
import { getIndustryChrome } from "./industry-chrome";
import type { BookVariableValues } from "../lib/book-variables";

// Resolve UMA foto de página V2 pro PDF. As fotos já caem em slots casados por
// orientação (horizontal em slot largo, vertical em slot alto), então o padrão
// é "preencher" (cover). Só corta com sharp quando o usuário reenquadrou
// (pan/zoom); senão devolve a URL e o react-pdf faz o cover sozinho.
async function resolveV2PhotoSource(
  url: string,
  adjustment: PhotoAdjustment | undefined,
  slotAspect: number,
): Promise<PhotoSource> {
  // "Caber inteira" (contain) mostra a foto completa — não cortar, senão
  // perderíamos justamente a assinatura/senha/logo que o usuário quer manter.
  // Ainda assim embute em JPEG (não deixa a URL pro react-pdf baixar).
  if (adjustment?.objectFit === "contain") {
    return toJpegSource(url);
  }
  if (
    adjustment &&
    (adjustment.zoom > 1 || adjustment.posX !== 50 || adjustment.posY !== 50)
  ) {
    try {
      const buffer = await cropPhotoForPdf(url, adjustment, slotAspect);
      return { data: buffer, format: "jpg" as const };
    } catch {
      return toJpegSource(url);
    }
  }
  return toJpegSource(url);
}

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

// Fonte de foto SEM corte: embute como JPEG (buffer) em vez de deixar a URL
// pro react-pdf baixar no render. Só assim toda foto entra no PDF, mesmo em
// fetch instável (book grande) ou formato que o react-pdf não decodifica.
// Último recurso mantém a URL (comportamento antigo) pra nunca quebrar o PDF.
async function toJpegSource(url: string): Promise<PhotoSource> {
  try {
    return { data: await reencodeToJpeg(url), format: "jpg" as const };
  } catch {
    return url;
  }
}

// Foto sem ajuste salvo: antes ia como URL direta (react-pdf baixava e fazia
// "cover" sozinho) — mas isso fazia fotos sumirem. Agora embute JPEG. Com
// ajuste, corta com sharp reproduzindo o pan/zoom do editor antes de embutir.
async function resolvePhotoSources(
  photos: string[],
  adjustments: PhotoAdjustmentMap,
  pattern: "PATTERN_1" | "PATTERN_2" | "PATTERN_3" | "PATTERN_4" | null,
  photoSlots: Map<number, PhotoSlotShape> | null,
): Promise<PhotoSource[]> {
  return Promise.all(
    photos.map(async (key, index) => {
      const adjustment = adjustments[key];
      if (!adjustment) return toJpegSource(constructUrl(key));

      let aspectRatio: number;
      if (photoSlots) {
        const slot = photoSlots.get(index);
        if (!slot) return toJpegSource(constructUrl(key));
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
            return toJpegSource(constructUrl(key));
          }
        }
        // "Caber inteira" sem foco precisa da imagem completa — cortar aqui
        // contradiria a opção e comeria parte da foto. Embute a foto inteira.
        if (slot.objectFit === "contain") {
          return toJpegSource(constructUrl(key));
        }
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
        // ainda embute a foto inteira em JPEG; só cai pra URL em último caso.
        return toJpegSource(constructUrl(key));
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
      // Modelo novo (auto-gerado ou imports pós-migration): 1 BookPage com
      // 1..4 BookItems (um por slot). O renderer materializa esses items em
      // photos[] pra uma única página do PDF.
      pages: {
        orderBy: { order: "asc" },
        include: {
          store: {
            select: {
              name: true,
              managerName: true,
              city: true,
              state: true,
            },
          },
          items: {
            orderBy: [{ slotIndex: "asc" }, { order: "asc" }],
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
      },
      // Modelo legado: BookItems soltos, um por página. Filtra bookPageId=null
      // pra não duplicar (as páginas novas já incluem seus items acima).
      items: {
        where: { bookPageId: null },
        orderBy: { order: "asc" },
        include: {
          pdvPhoto: {
            include: {
              store: {
                select: {
                  name: true,
                  managerName: true,
                  city: true,
                  state: true,
                },
              },
              mediaType: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!book) throw new Error("Book não encontrado");

  // Capa e página final ATUAIS da indústria (padrões kind=COVER/CLOSING de
  // /padroes) são a fonte da verdade: trocar a logo lá reflete no PDF sem
  // depender do snapshot copiado na geração. Só caem no snapshot do book (ou no
  // BookTemplate/legado) quando a indústria não tem esses padrões.
  const industryChrome = await getIndustryChrome(
    book.organizationId,
    book.supplierId,
  );

  const template =
    (industryChrome.cover || book.coverLayout) &&
    (industryChrome.closing || book.closingLayout)
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
    industryChrome.cover?.layout ??
    book.coverLayout ??
    template?.coverLayout ??
    buildDefaultCoverLayout();
  const paginaFinal =
    industryChrome.closing?.layout ??
    book.closingLayout ??
    template?.closingLayout ??
    buildDefaultClosingLayout();
  const fundoCapa =
    industryChrome.cover?.background ??
    book.coverBackground ??
    template?.coverBackground ??
    null;
  const fundoFinal =
    industryChrome.closing?.background ??
    book.closingBackground ??
    template?.closingBackground ??
    null;

  const distributorKey = book.distributorLogo ?? book.organization.logo;
  const logos = {
    organization: distributorKey,
    supplier: book.supplier?.logo ?? null,
  };
  const pageLayout = resolveLayoutImages(book.pageLayout, logos);
  const bookPhotoSlots = buildPhotoSlotMap(pageLayout);

  // Modelo novo: cada BookPage vira 1 página do PDF. Fotos vêm dos N
  // BookItems (uma foto por item — a primeira do PdvPhoto.photos[]);
  // metadados de descrição (gerente, seção, código, etc.) vêm do PdvPhoto
  // do slot 0 — as capturas de uma mesma loja no mesmo mês tendem a
  // repetir esses campos, então fixar no primeiro é suficiente pro MVP.
  const pageItems = await Promise.all(
    book.pages.map(async (page) => {
      const itemsInPage = page.items.filter((it) => it.pdvPhoto.photos[0]);
      const primary = itemsInPage[0]?.pdvPhoto;

      const itemPageLayout = resolveLayoutImages(page.pageLayout, logos);
      const photoSlots = itemPageLayout
        ? buildPhotoSlotMap(itemPageLayout)
        : bookPhotoSlots;

      // 1 foto por item. Cada foto decide cover vs caber-inteira conforme o
      // ajuste do usuário (photoAdjustments do PdvPhoto, keyed pela key da
      // foto) ou, sem ajuste, pela orientação vs o slot (sharp lê as dims).
      const photosInPage = itemsInPage
        .filter((it) => Boolean(it.pdvPhoto.photos[0]))
        .map((it) => {
          const key = it.pdvPhoto.photos[0];
          return {
            key,
            adjustment: readPhotoAdjustments(it.pdvPhoto.photoAdjustments)[key],
            capturedCity: it.pdvPhoto.capturedCity,
            capturedState: it.pdvPhoto.capturedState,
            promoterName: it.pdvPhoto.promoterName,
          };
        });

      const photoSources = await Promise.all(
        photosInPage.map((p, index) => {
          const slot = photoSlots?.get(index);
          const slotAspect = slot
            ? slot.aspectRatio
            : getSlotAspectRatio(null, index, photosInPage.length);
          return resolveV2PhotoSource(
            constructUrl(p.key),
            p.adjustment,
            slotAspect,
          );
        }),
      );

      // Fit efetivo por foto: o ajuste do usuário ("Caber inteira") vence o do
      // slot do padrão. É o que o cover-layout-view usa pra não cortar.
      const photoFits = photosInPage.map(
        (p, index) =>
          p.adjustment?.objectFit ??
          photoSlots?.get(index)?.objectFit ??
          "cover",
      );

      return {
        pageLayout: itemPageLayout,
        pageBackground: itemPageLayout
          ? readBackground(page.pageBackground)
          : null,
        storeName: page.store?.name ?? null,
        storeManager: primary?.managerName ?? page.store?.managerName ?? null,
        storeCity: page.store?.city ?? null,
        storeState: page.store?.state ?? null,
        coordinatorName: primary?.coordinatorName ?? null,
        consultantName: primary?.consultantName ?? null,
        responsibleCompany: primary?.responsibleCompany ?? null,
        mediaTypeName: primary?.mediaType?.name ?? null,
        section: primary?.section ?? null,
        code: primary?.code ?? null,
        actionValueLabel: primary?.actionValue
          ? currency.format(Number(primary.actionValue))
          : null,
        photoSources,
        photoFits,
        // Captura por foto (pra variáveis quando um texto referencia uma foto):
        // cidade/UF da loja com fallback pra captura, e o promotor.
        photoCaptures: photosInPage.map((p) => ({
          cidade: page.store?.city ?? p.capturedCity ?? null,
          uf: page.store?.state ?? p.capturedState ?? null,
          promotor: p.promoterName ?? null,
        })),
        // O fundo desfocado já vem composto na própria imagem (caber-inteira),
        // então não há backdrop separado no modelo V2.
        photoBackdrops: photoSources.map(() => undefined),
        photoLayoutPattern: null,
      };
    }),
  );

  // Modelo legado (BookItems solo): mantém o comportamento original — cada
  // BookItem é uma página independente com todas as fotos do próprio PdvPhoto.
  const legacyItems = await Promise.all(
    book.items.map(async (item) => {
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
        storeCity: item.pdvPhoto.store.city,
        storeState: item.pdvPhoto.store.state,
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

  // Numeração sequencial das fotos no book inteiro (legenda "FOTO N"): as
  // páginas V2 já estão em ordem; conta uma por foto renderizada. Monta também
  // as variáveis por foto (numeroFoto/cidade/uf/promotor) pros textos que
  // referenciam uma foto.
  let runningPhotoNumber = 1;
  const numberedPageItems = pageItems.map((item) => {
    const photoNumbers = item.photoSources.map(() => runningPhotoNumber++);
    const photoVariables: Record<number, BookVariableValues> = {};
    item.photoCaptures.forEach((cap, slotIndex) => {
      photoVariables[slotIndex] = {
        numeroFoto: String(photoNumbers[slotIndex]),
        cidade: cap.cidade,
        uf: cap.uf,
        promotor: cap.promotor,
      };
    });
    return { ...item, photoNumbers, photoVariables };
  });

  const items = [...numberedPageItems, ...legacyItems];

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
    showPhotoNumbers: book.showPhotoNumbers,
  };

  const buffer = await renderToBuffer(<BookDocument data={data} />);
  const key = `books/${bookId}-${uuidv4()}.pdf`;
  await uploadBufferToR2(key, Buffer.from(buffer), "application/pdf");

  // generatedAt e updatedAt no MESMO instante — senão o @updatedAt (gravado no
  // momento do write, alguns ms depois de `new Date()`) fica > generatedAt e o
  // book aparece como "PDF desatualizado" logo após gerar.
  const now = new Date();
  await prisma.book.update({
    where: { id: bookId },
    data: {
      pdfKey: key,
      status: "READY",
      generatedAt: now,
      updatedAt: now,
    },
  });

  return key;
}
