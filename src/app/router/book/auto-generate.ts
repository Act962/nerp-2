import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  MAX_PER_PAGE,
  photoPatternLabel,
  type PhotoOrientation,
} from "@/features/books/server/distribute-photos";
import { ensurePhotoOrientations } from "@/features/books/server/photo-aspects";
import { z } from "zod";

// Auto-gera um book: 1 book, N BookPages (por loja e orientação). Horizontais
// vão em páginas de ≤2, verticais em ≤4, cada página no padrão da indústria
// para aquela (orientação, tamanho). Bloqueia se algum padrão NECESSÁRIO no
// período (ou capa/final) não existir.
export const autoGenerateBook = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().min(1, "Informe o nome do book"),
      supplierId: z.string(),
      periodMonth: z.number().int().min(1).max(12),
      periodYear: z.number().int().min(2000).max(2100),
      storeIds: z.array(z.string()).optional(),
      distributorLogo: z.string().optional(),
    }),
  )
  .output(
    z.object({
      bookId: z.string(),
      storesCount: z.number(),
      pagesCount: z.number(),
      photosCount: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!supplier) {
      throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
    }

    const { from, to } = monthRange(input.periodMonth, input.periodYear);

    const photos = await prisma.pdvPhoto.findMany({
      where: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        approvalStatus: "APPROVED",
        promoterName: { not: null },
        capturedAt: { gte: from, lt: to },
        ...(input.storeIds && input.storeIds.length > 0
          ? { storeId: { in: input.storeIds } }
          : {}),
      },
      orderBy: [{ storeId: "asc" }, { capturedAt: "asc" }],
      select: {
        id: true,
        storeId: true,
        photos: true,
        photoAspect: true,
        store: { select: { name: true } },
      },
    });

    if (photos.length === 0) {
      throw errors.BAD_REQUEST({
        message:
          "Nenhuma foto aprovada dessa indústria neste período — nada pra gerar.",
      });
    }

    // Orientação de cada foto (cacheia photoAspect na 1ª vez).
    const orientationByPhoto = await ensurePhotoOrientations(photos);

    // Agrupa por loja, separando as fotos por orientação (ordem cronológica).
    const groups = new Map<
      string,
      { storeName: string; landscape: string[]; portrait: string[] }
    >();
    for (const p of photos) {
      const g = groups.get(p.storeId) ?? {
        storeName: p.store.name,
        landscape: [],
        portrait: [],
      };
      if (orientationByPhoto.get(p.id) === "LANDSCAPE") g.landscape.push(p.id);
      else g.portrait.push(p.id);
      groups.set(p.storeId, g);
    }
    const orderedStores = Array.from(groups.entries()).sort(([, a], [, b]) =>
      a.storeName.localeCompare(b.storeName, "pt-BR"),
    );

    // Planeja as páginas (orientação + tamanho) de todas as lojas.
    const storePlans = orderedStores.map(([storeId, g]) => {
      const pages: {
        orientation: PhotoOrientation;
        photoIds: string[];
      }[] = [];
      for (const ids of [g.landscape, g.portrait]) {
        const orientation: PhotoOrientation =
          ids === g.landscape ? "LANDSCAPE" : "PORTRAIT";
        const max = MAX_PER_PAGE[orientation];
        for (let i = 0; i < ids.length; i += max) {
          pages.push({ orientation, photoIds: ids.slice(i, i + max) });
        }
      }
      return { storeId, pages };
    });

    // Templates da indústria.
    const allTemplates = await prisma.bookPageTemplate.findMany({
      where: { organizationId: context.org.id, supplierId: input.supplierId },
      select: {
        kind: true,
        photoOrientation: true,
        photoSize: true,
        layout: true,
        background: true,
      },
    });
    const coverTemplate = allTemplates.find((t) => t.kind === "COVER");
    const closingTemplate = allTemplates.find((t) => t.kind === "CLOSING");

    const photoTemplateKey = (o: PhotoOrientation, size: number) =>
      `${o}-${size}`;
    const photoTemplates = new Map<
      string,
      { layout: Prisma.JsonValue; background: Prisma.JsonValue | null }
    >();
    for (const t of allTemplates) {
      if (t.kind === "PHOTO" && t.photoOrientation && t.photoSize) {
        photoTemplates.set(photoTemplateKey(t.photoOrientation, t.photoSize), {
          layout: t.layout,
          background: t.background,
        });
      }
    }

    // Bloqueio: capa + final + os padrões (orientação,tamanho) que o período usa.
    const missing = new Set<string>();
    if (!coverTemplate) missing.add("capa");
    if (!closingTemplate) missing.add("página final");
    for (const sp of storePlans) {
      for (const page of sp.pages) {
        const key = photoTemplateKey(page.orientation, page.photoIds.length);
        if (!photoTemplates.has(key)) {
          missing.add(
            photoPatternLabel(page.orientation, page.photoIds.length),
          );
        }
      }
    }
    if (missing.size > 0) {
      throw errors.BAD_REQUEST({
        message: `Faltam padrões para esta indústria: ${[...missing].join(", ")}. Configure em Padrões antes de gerar.`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          organizationId: context.org.id,
          name: input.name,
          supplierId: input.supplierId,
          periodMonth: input.periodMonth,
          periodYear: input.periodYear,
          distributorLogo: input.distributorLogo,
          createdById: context.user.id,
          coverLayout: coverTemplate?.layout ?? Prisma.DbNull,
          coverBackground: coverTemplate?.background ?? Prisma.DbNull,
          closingLayout: closingTemplate?.layout ?? Prisma.DbNull,
          closingBackground: closingTemplate?.background ?? Prisma.DbNull,
        },
        select: { id: true },
      });

      let pageOrder = 0;
      let itemOrder = 0;
      let pagesCount = 0;

      for (const sp of storePlans) {
        for (const page of sp.pages) {
          const tmpl = photoTemplates.get(
            photoTemplateKey(page.orientation, page.photoIds.length),
          );
          const bookPage = await tx.bookPage.create({
            data: {
              bookId: book.id,
              storeId: sp.storeId,
              order: pageOrder++,
              autoGenerated: true,
              ...(tmpl
                ? {
                    pageLayout: tmpl.layout ?? Prisma.DbNull,
                    pageBackground: tmpl.background ?? Prisma.DbNull,
                  }
                : {}),
            },
            select: { id: true },
          });

          await tx.bookItem.createMany({
            data: page.photoIds.map((pdvPhotoId, i) => ({
              bookId: book.id,
              bookPageId: bookPage.id,
              pdvPhotoId,
              slotIndex: i,
              order: itemOrder++,
            })),
          });
          pagesCount++;
        }
      }

      return {
        bookId: book.id,
        storesCount: orderedStores.length,
        pagesCount,
        photosCount: photos.length,
      };
    });

    return result;
  });

function monthRange(month: number, year: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from, to };
}
