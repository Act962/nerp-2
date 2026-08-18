import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { generateBook } from "@/features/books/server/generate-book";
import prisma from "@/lib/db";
import { bookGenerateRequested, inngest } from "@/lib/inngest/client";
import { z } from "zod";

type GenerateErrors = {
  INTERNAL_SERVER_ERROR: (options: { message: string }) => Error;
};

/**
 * Geração síncrona (fallback): renderiza o PDF na própria request. Usada quando
 * o Inngest está indisponível ou quando o cliente pede explicitamente (`sync`).
 * Em falha, marca FAILED para o book nunca ficar preso em GENERATING.
 */
async function generateInline(bookId: string, errors: GenerateErrors) {
  try {
    await generateBook(bookId);
    return { status: "READY" as const };
  } catch (error) {
    await prisma.book
      .update({ where: { id: bookId }, data: { status: "FAILED" } })
      .catch(() => {});
    console.error(
      `[book.generate] falha na geração inline de ${bookId}:`,
      error,
    );
    throw errors.INTERNAL_SERVER_ERROR({
      message: "Não foi possível gerar o PDF do book. Tente novamente.",
    });
  }
}

export const generateBookPdf = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string(), sync: z.boolean().optional() }))
  .handler(async ({ input, context, errors }) => {
    const book = await prisma.book.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, _count: { select: { items: true } } },
    });
    if (!book) {
      throw errors.NOT_FOUND({ message: "Book não encontrado" });
    }
    if (book._count.items === 0) {
      throw errors.BAD_REQUEST({
        message: "Adicione ao menos uma foto antes de gerar o book.",
      });
    }

    await prisma.book.update({
      where: { id: input.id },
      data: { status: "GENERATING" },
    });

    // Modo síncrono explícito (ex.: fila travada): pula o Inngest.
    if (input.sync) {
      return generateInline(input.id, errors);
    }

    try {
      await inngest.send(bookGenerateRequested.create({ bookId: input.id }));
      return { status: "GENERATING" as const };
    } catch (sendError) {
      // Inngest indisponível (fora do ar / dev server desligado): sem worker,
      // o book ficaria preso em GENERATING. Gera inline para garantir o PDF.
      console.error(
        `[book.generate] inngest.send falhou para ${input.id}, gerando inline:`,
        sendError,
      );
      return generateInline(input.id, errors);
    }
  });
