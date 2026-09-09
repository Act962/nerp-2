import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";
import {
  coverBackgroundSchema,
  coverLayoutSchema,
} from "./cover-layout-schema";

export const updateBookCoverLayout = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string(),
      coverLayout: coverLayoutSchema,
      closingLayout: coverLayoutSchema,
      coverBackground: coverBackgroundSchema,
      closingBackground: coverBackgroundSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }

    // `customChrome` liga aqui: a partir da primeira edição feita dentro do
    // book, a capa é dele e não segue mais o padrão COVER/CLOSING da indústria.
    // Sem essa marca o padrão vencia na leitura e a edição sumia sem aviso.
    // O editor só chama isto depois de uma edição de verdade (`hasUserEdited`),
    // então abrir a aba não desliga a herança.
    return prisma.book.update({
      where: { id: input.id },
      data: {
        coverLayout: input.coverLayout,
        closingLayout: input.closingLayout,
        coverBackground: input.coverBackground,
        closingBackground: input.closingBackground,
        customChrome: true,
      },
      select: { id: true },
    });
  });
