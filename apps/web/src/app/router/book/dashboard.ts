import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Painel em /books. Fotos aprovadas/reprovadas contam no nível da FOTO (QC da
// coordenadora sobre as capturas do promotor). Um book é "completo" quando tem
// páginas e todas as fotos daquelas páginas estão aprovadas.
export const bookDashboard = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const [books, photoCounts] = await Promise.all([
      prisma.book.findMany({
        where: { organizationId: context.org.id },
        select: {
          supplierId: true,
          sentAt: true,
          items: {
            select: { pdvPhoto: { select: { approvalStatus: true } } },
          },
        },
      }),
      prisma.pdvPhoto.groupBy({
        by: ["approvalStatus"],
        where: { organizationId: context.org.id, promoterName: { not: null } },
        _count: true,
      }),
    ]);

    let booksComplete = 0;
    let booksSent = 0;
    const supplierIds = new Set<string>();

    for (const book of books) {
      if (book.supplierId) supplierIds.add(book.supplierId);
      if (book.sentAt) booksSent += 1;

      const allApproved =
        book.items.length > 0 &&
        book.items.every((item) => item.pdvPhoto.approvalStatus === "APPROVED");
      if (allApproved) booksComplete += 1;
    }

    const countBy = (status: string) =>
      photoCounts.find((row) => row.approvalStatus === status)?._count ?? 0;

    return {
      booksComplete,
      booksIncomplete: books.length - booksComplete,
      suppliers: supplierIds.size,
      photosPending: countBy("PENDING"),
      photosApproved: countBy("APPROVED"),
      photosRejected: countBy("REJECTED"),
      booksSent,
    };
  });
