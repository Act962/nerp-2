import type { Prisma } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient;

/**
 * Coloca uma foto num slot da página: troca o `pdvPhotoId` se o slot já tem
 * item, senão cria um item novo no fim da ordem do book.
 *
 * Compartilhado por `setSlotPhoto` (foto que já existe no acervo) e
 * `uploadSlotPhoto` (arquivo vindo do computador) — as duas terminam no mesmo
 * lugar, e o `@@unique([bookPageId, slotIndex])` não perdoa duas implementações
 * divergindo.
 */
export async function assignSlotPhoto(
  db: Db,
  input: {
    bookId: string;
    bookPageId: string;
    slotIndex: number;
    pdvPhotoId: string;
  },
): Promise<{ itemId: string }> {
  const existing = await db.bookItem.findFirst({
    where: { bookPageId: input.bookPageId, slotIndex: input.slotIndex },
    select: { id: true },
  });

  if (existing) {
    await db.bookItem.update({
      where: { id: existing.id },
      data: { pdvPhotoId: input.pdvPhotoId },
    });
    return { itemId: existing.id };
  }

  const last = await db.bookItem.findFirst({
    where: { bookId: input.bookId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const created = await db.bookItem.create({
    data: {
      bookId: input.bookId,
      bookPageId: input.bookPageId,
      pdvPhotoId: input.pdvPhotoId,
      slotIndex: input.slotIndex,
      order: (last?.order ?? -1) + 1,
    },
    select: { id: true },
  });
  return { itemId: created.id };
}
