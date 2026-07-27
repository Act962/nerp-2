import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { z } from "zod";

export const getBook = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      include: {
        supplier: {
          select: { id: true, name: true, logo: true },
        },
        organization: { select: { name: true, tradeName: true, logo: true } },
        items: {
          orderBy: { order: "asc" },
          include: {
            pdvPhoto: {
              select: {
                id: true,
                photos: true,
                section: true,
                code: true,
                actionValue: true,
                coordinatorName: true,
                consultantName: true,
                responsibleCompany: true,
                photoLayout: true,
                photoAdjustments: true,
                capturedAt: true,
                mediaTypeId: true,
                managerName: true,
                store: { select: { name: true, managerName: true } },
                mediaType: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }

    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true, permissions: true },
    });
    const canApprove = memberCan(member, "books-aprovar");

    return {
      id: book.id,
      name: book.name,
      canApprove,
      sentAt: book.sentAt?.toISOString() ?? null,
      sentByName: book.sentByName,
      supplierId: book.supplierId,
      supplierName: book.supplier?.name ?? null,
      supplierLogo: book.supplier?.logo ?? null,
      organizationName: book.organization.tradeName ?? book.organization.name,
      // Igual ao generate-book: logo do book vence, senão o da organização.
      distributorLogo: book.distributorLogo ?? book.organization.logo,
      periodMonth: book.periodMonth,
      periodYear: book.periodYear,
      status: book.status,
      pdfKey: book.pdfKey,
      coverLayout: book.coverLayout,
      closingLayout: book.closingLayout,
      pageLayout: book.pageLayout,
      coverBackground: book.coverBackground,
      closingBackground: book.closingBackground,
      pageBackground: book.pageBackground,
      generatedAt: book.generatedAt?.toISOString() ?? null,
      // Editado depois de gerar = o PDF em mãos não reflete o que está na tela.
      pdfDesatualizado: !!book.generatedAt && book.updatedAt > book.generatedAt,
      items: book.items.map((item) => ({
        id: item.id,
        pdvPhotoId: item.pdvPhotoId,
        order: item.order,
        // Só o booleano: o card usa isso apenas pra sinalizar que a página foge
        // do layout do book. Mandar o layout inteiro custa ~5 KB por página e
        // ninguém no client lê o conteúdo.
        // Só páginas com layout próprio carregam JSON aqui — as demais mandam
        // null e o card cai no `pageLayout` do book, que já vem uma vez só.
        pageLayout: item.pageLayout,
        pageBackground: item.pageBackground,
        hasOwnPageLayout: Array.isArray(item.pageLayout),
        approvalStatus: item.approvalStatus,
        approvalNote: item.approvalNote,
        reviewedByName: item.reviewedByName,
        reviewedAt: item.reviewedAt?.toISOString() ?? null,
        storeName: item.pdvPhoto.store.name,
        // Snapshot da página vence; vazio cai no gerente cadastrado na loja.
        managerName:
          item.pdvPhoto.managerName ?? item.pdvPhoto.store.managerName,
        mediaTypeId: item.pdvPhoto.mediaTypeId,
        mediaTypeName: item.pdvPhoto.mediaType?.name ?? null,
        section: item.pdvPhoto.section,
        code: item.pdvPhoto.code,
        actionValue: item.pdvPhoto.actionValue
          ? Number(item.pdvPhoto.actionValue)
          : null,
        coordinatorName: item.pdvPhoto.coordinatorName,
        consultantName: item.pdvPhoto.consultantName,
        responsibleCompany: item.pdvPhoto.responsibleCompany,
        photoLayout: item.pdvPhoto.photoLayout,
        photoAdjustments: item.pdvPhoto.photoAdjustments as Record<
          string,
          { zoom: number; posX: number; posY: number }
        > | null,
        capturedAt: item.pdvPhoto.capturedAt.toISOString(),
        photos: item.pdvPhoto.photos,
      })),
    };
  });
