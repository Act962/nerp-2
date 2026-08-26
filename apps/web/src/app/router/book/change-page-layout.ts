import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  buildBasePhotoLayout,
  type CoverElement,
} from "@/features/books/lib/cover-layout";
import { z } from "zod";

// Orientação dos slots ATUAIS da página (largura > altura = horizontal). Serve
// pra saber a orientação das fotos que vão sobrar ao reduzir o número de slots.
function inferOrientation(
  layout: unknown,
  fallbackLayout: unknown,
): "LANDSCAPE" | "PORTRAIT" {
  const arr = (Array.isArray(layout) ? layout : []) as CoverElement[];
  const fallback = (
    Array.isArray(fallbackLayout) ? fallbackLayout : []
  ) as CoverElement[];
  const slots = [...arr, ...fallback].filter((el) => el.type === "photoSlot");
  const slot = slots[0];
  if (slot && slot.height > 0) {
    return slot.width >= slot.height ? "LANDSCAPE" : "PORTRAIT";
  }
  return "PORTRAIT";
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

// Altera o "padrão da página": remonta os slots (orientação + quantidade)
// mantendo o chrome, reaproveita as fotos existentes e joga as que sobram em
// páginas NOVAS logo após, com o padrão da orientação delas.
export const changeBookPageLayout = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      bookPageId: z.string(),
      orientation: z.enum(["LANDSCAPE", "PORTRAIT"]),
      size: z.number().int().min(1).max(3),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const page = await prisma.bookPage.findFirst({
      where: { id: input.bookPageId, book: { organizationId: context.org.id } },
      select: {
        id: true,
        bookId: true,
        order: true,
        storeId: true,
        pageLayout: true,
        pageBackground: true,
        book: { select: { pageLayout: true } },
        items: {
          orderBy: [{ slotIndex: "asc" }, { order: "asc" }],
          select: {
            id: true,
            slotIndex: true,
            pdvPhoto: { select: { photos: true } },
          },
        },
      },
    });
    if (!page) throw errors.NOT_FOUND({ message: "Página não encontrada" });

    // Base do chrome: layout próprio da página ou, na falta, o do book.
    const baseLayout = Array.isArray(page.pageLayout)
      ? page.pageLayout
      : page.book.pageLayout;

    const currentOrientation = inferOrientation(
      page.pageLayout,
      page.book.pageLayout,
    );

    // Só itens COM foto entram na redistribuição; slots vazios são recriados
    // sob demanda ao clicar num slot.
    const withPhoto = page.items.filter((it) => it.pdvPhoto.photos[0]);
    const keep = withPhoto.slice(0, input.size);
    const leftover = withPhoto.slice(input.size);

    const newLayout = buildBasePhotoLayout(
      baseLayout,
      input.orientation,
      input.size,
    );

    await prisma.$transaction(async (tx) => {
      await tx.bookPage.update({
        where: { id: page.id },
        data: { pageLayout: newLayout as unknown as Prisma.InputJsonValue },
      });

      // Remove todos os BookItems atuais da página (empties e os que vão migrar)
      // e recria só os que ficam, nos slots 0..n-1.
      await tx.bookItem.deleteMany({
        where: {
          bookPageId: page.id,
          id: { notIn: withPhoto.map((it) => it.id) },
        },
      });
      for (let i = 0; i < keep.length; i++) {
        if (keep[i].slotIndex !== i) {
          await tx.bookItem.update({
            where: { id: keep[i].id },
            data: { slotIndex: i },
          });
        }
      }

      if (leftover.length > 0) {
        const max = currentOrientation === "LANDSCAPE" ? 2 : 3;
        const chunks = chunk(leftover, max);
        // Abre espaço na ordenação pras novas páginas logo após esta.
        await tx.bookPage.updateMany({
          where: { bookId: page.bookId, order: { gt: page.order } },
          data: { order: { increment: chunks.length } },
        });
        for (let c = 0; c < chunks.length; c++) {
          const chunkItems = chunks[c];
          const chunkLayout = buildBasePhotoLayout(
            baseLayout,
            currentOrientation,
            chunkItems.length,
          );
          const created = await tx.bookPage.create({
            data: {
              bookId: page.bookId,
              storeId: page.storeId,
              order: page.order + 1 + c,
              pageLayout: chunkLayout as unknown as Prisma.InputJsonValue,
              pageBackground:
                (page.pageBackground as Prisma.InputJsonValue | null) ??
                Prisma.DbNull,
            },
            select: { id: true },
          });
          for (let s = 0; s < chunkItems.length; s++) {
            await tx.bookItem.update({
              where: { id: chunkItems[s].id },
              data: { bookPageId: created.id, slotIndex: s },
            });
          }
        }
      }
    });

    return { ok: true };
  });
