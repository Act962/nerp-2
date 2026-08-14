import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { getIndustryChromeBatch } from "@/features/books/server/industry-chrome";
import prisma from "@/lib/db";
import { z } from "zod";

export const listBook = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .handler(async ({ context }) => {
    const books = await prisma.book.findMany({
      where: { organizationId: context.org.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        periodMonth: true,
        periodYear: true,
        status: true,
        pdfKey: true,
        generatedAt: true,
        sentAt: true,
        supplierId: true,
        distributorLogo: true,
        coverLayout: true,
        coverBackground: true,
        supplier: { select: { name: true, logo: true } },
        organization: { select: { logo: true } },
        _count: { select: { items: true } },
        items: { select: { approvalStatus: true } },
      },
    });

    // Capa é resolvida do padrão ATUAL da indústria (fonte da verdade); o
    // coverLayout salvo no book é só fallback pra books sem padrão.
    const chrome = await getIndustryChromeBatch(
      context.org.id,
      books.map((b) => b.supplierId).filter((id): id is string => id !== null),
    );

    return {
      books: books.map((book) => {
        const industryCover = book.supplierId
          ? chrome.get(book.supplierId)?.cover
          : null;
        const rejectedCount = book.items.filter(
          (item) => item.approvalStatus === "REJECTED",
        ).length;
        const approvedCount = book.items.filter(
          (item) => item.approvalStatus === "APPROVED",
        ).length;
        return {
          id: book.id,
          name: book.name,
          periodMonth: book.periodMonth,
          periodYear: book.periodYear,
          status: book.status,
          pdfKey: book.pdfKey,
          generatedAt: book.generatedAt?.toISOString() ?? null,
          sentAt: book.sentAt?.toISOString() ?? null,
          supplierName: book.supplier?.name ?? null,
          itemsCount: book._count.items,
          rejectedCount,
          approvedCount,
          // Capa pra miniatura da vista "Capas": padrão atual da indústria
          // vence o snapshot do book, então trocar a logo em /padroes reflete
          // aqui na hora.
          coverLayout: industryCover?.layout ?? book.coverLayout,
          coverBackground: industryCover?.background ?? book.coverBackground,
          organizationLogo: book.distributorLogo ?? book.organization.logo,
          supplierLogo: book.supplier?.logo ?? null,
        };
      }),
    };
  });
