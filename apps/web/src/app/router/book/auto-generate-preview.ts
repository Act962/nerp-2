import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import {
  MAX_PER_PAGE,
  photoPatternLabel,
  type PhotoOrientation,
} from "@/features/books/server/distribute-photos";
import { ensurePhotoOrientations } from "@/features/books/server/photo-aspects";

// Preview do auto-gerador orientation-aware: agrupa as fotos aprovadas por loja
// e orientação, planeja as páginas (horizontais ≤2, verticais ≤4) e diz quais
// padrões faltam pra este período. NÃO persiste nada.
export const autoGeneratePreview = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      supplierId: z.string(),
      periodMonth: z.number().int().min(1).max(12),
      periodYear: z.number().int().min(2000).max(2100),
    }),
  )
  .output(
    z.object({
      supplierId: z.string(),
      supplierName: z.string(),
      periodMonth: z.number(),
      periodYear: z.number(),
      totalStores: z.number(),
      totalPhotos: z.number(),
      totalPages: z.number(),
      isComplete: z.boolean(),
      // Rótulos legíveis do que falta (ex.: "capa", "2 fotos verticais").
      missingRequired: z.array(z.string()),
      stores: z.array(
        z.object({
          storeId: z.string(),
          storeName: z.string(),
          city: z.string().nullable(),
          state: z.string().nullable(),
          photosCount: z.number(),
          landscapeCount: z.number(),
          portraitCount: z.number(),
          // Cada página planejada como { orientation, size }.
          pagesPlanned: z.array(
            z.object({
              orientation: z.enum(["LANDSCAPE", "PORTRAIT"]),
              size: z.number(),
            }),
          ),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, organizationId: context.org.id },
      select: { id: true, name: true },
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
      },
      orderBy: [{ storeId: "asc" }, { capturedAt: "asc" }],
      select: {
        id: true,
        storeId: true,
        photos: true,
        photoAspect: true,
        store: { select: { name: true, city: true, state: true } },
      },
    });

    const orientationByPhoto = await ensurePhotoOrientations(photos);

    const byStore = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        city: string | null;
        state: string | null;
        landscape: number;
        portrait: number;
      }
    >();
    for (const p of photos) {
      const g = byStore.get(p.storeId) ?? {
        storeId: p.storeId,
        storeName: p.store.name,
        city: p.store.city,
        state: p.store.state,
        landscape: 0,
        portrait: 0,
      };
      if (orientationByPhoto.get(p.id) === "LANDSCAPE") g.landscape++;
      else g.portrait++;
      byStore.set(p.storeId, g);
    }

    const planFor = (count: number, orientation: PhotoOrientation) => {
      const max = MAX_PER_PAGE[orientation];
      const pages: { orientation: PhotoOrientation; size: number }[] = [];
      let remaining = count;
      while (remaining > 0) {
        const size = Math.min(max, remaining);
        pages.push({ orientation, size });
        remaining -= size;
      }
      return pages;
    };

    const stores = Array.from(byStore.values())
      .map((s) => {
        const pagesPlanned = [
          ...planFor(s.landscape, "LANDSCAPE"),
          ...planFor(s.portrait, "PORTRAIT"),
        ];
        return {
          storeId: s.storeId,
          storeName: s.storeName,
          city: s.city,
          state: s.state,
          photosCount: s.landscape + s.portrait,
          landscapeCount: s.landscape,
          portraitCount: s.portrait,
          pagesPlanned,
        };
      })
      .sort((a, b) => a.storeName.localeCompare(b.storeName, "pt-BR"));

    // Padrões existentes da indústria.
    const templates = await prisma.bookPageTemplate.findMany({
      where: { organizationId: context.org.id, supplierId: input.supplierId },
      select: { kind: true, photoOrientation: true, photoSize: true },
    });
    let hasCover = false;
    let hasClosing = false;
    const photoKeys = new Set<string>();
    for (const t of templates) {
      if (t.kind === "COVER") hasCover = true;
      else if (t.kind === "CLOSING") hasClosing = true;
      else if (t.kind === "PHOTO" && t.photoOrientation && t.photoSize) {
        photoKeys.add(`${t.photoOrientation}-${t.photoSize}`);
      }
    }

    const missing = new Set<string>();
    if (!hasCover) missing.add("capa");
    if (!hasClosing) missing.add("página final");
    for (const s of stores) {
      for (const page of s.pagesPlanned) {
        if (!photoKeys.has(`${page.orientation}-${page.size}`)) {
          missing.add(photoPatternLabel(page.orientation, page.size));
        }
      }
    }

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      totalStores: stores.length,
      totalPhotos: photos.length,
      totalPages: stores.reduce((acc, s) => acc + s.pagesPlanned.length, 0),
      isComplete: missing.size === 0,
      missingRequired: [...missing],
      stores,
    };
  });

function monthRange(month: number, year: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from, to };
}
