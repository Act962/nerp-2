import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { reapplyBaseChrome } from "@/features/books/lib/cover-layout";
import { z } from "zod";

// Reaplica o visual do PADRÃO BASE (fundo + logos + textos) a todas as páginas
// de fotos da indústria, preservando o arranjo de espaços de foto de cada uma.
// Não toca em capa/página final (não herdam base). Devolve quantas atualizou.
export const reapplyIndustryBase = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ supplierId: z.string() }))
  .output(z.object({ updated: z.number() }))
  .handler(async ({ input, context, errors }) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!supplier) {
      throw errors.NOT_FOUND({ message: "Indústria não encontrada" });
    }

    const baseTemplate = await prisma.bookPageTemplate.findFirst({
      where: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        isBase: true,
      },
      select: { layout: true, background: true },
    });
    if (!baseTemplate) {
      throw errors.BAD_REQUEST({
        message: "Crie o padrão base antes de reaplicar.",
      });
    }

    const photos = await prisma.bookPageTemplate.findMany({
      where: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        kind: "PHOTO",
      },
      select: { id: true, layout: true },
    });

    for (const photo of photos) {
      const layout = reapplyBaseChrome(baseTemplate.layout, photo.layout);
      await prisma.bookPageTemplate.update({
        where: { id: photo.id },
        data: {
          layout: layout as unknown as Prisma.InputJsonValue,
          background:
            baseTemplate.background as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return { updated: photos.length };
  });
