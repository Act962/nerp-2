import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Atualiza o estágio de um lead do inbox (novo → em contato → ganho/arquivado).
export const updateInterestStatus = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      id: z.string().min(1),
      status: z.enum(["NOVO", "EM_CONTATO", "GANHO", "ARQUIVADO"]),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const interest = await prisma.spaceInterest.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!interest) throw errors.NOT_FOUND({ message: "Lead não encontrado" });

    await prisma.spaceInterest.update({
      where: { id: interest.id },
      data: { status: input.status },
    });

    return { ok: true };
  });
