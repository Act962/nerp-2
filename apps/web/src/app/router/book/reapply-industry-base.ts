import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { reapplyBaseChrome } from "@/features/books/lib/cover-layout";
import { z } from "zod";

// Reaplica o visual do PADRÃO BASE (fundo + logos + textos) às páginas de fotos,
// extras e página final (CLOSING) da indústria, preservando o arranjo de espaços
// de foto de cada uma (extras/final não têm slots → ficam só com o chrome do
// base). A capa (COVER) não herda base. Devolve quantas atualizou.
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

    const pages = await prisma.bookPageTemplate.findMany({
      where: {
        organizationId: context.org.id,
        supplierId: input.supplierId,
        kind: { in: ["PHOTO", "EXTRA", "CLOSING"] },
      },
      select: { id: true, layout: true },
    });

    for (const page of pages) {
      const layout = reapplyBaseChrome(baseTemplate.layout, page.layout);
      await prisma.bookPageTemplate.update({
        where: { id: page.id },
        data: {
          layout: layout as unknown as Prisma.InputJsonValue,
          background:
            baseTemplate.background as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return { updated: pages.length };
  });
