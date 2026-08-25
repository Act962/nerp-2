import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deleteSpaceNegotiation = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .output(z.object({ success: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.spaceNegotiation.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Negociação não encontrada" });
    }

    await prisma.spaceNegotiation.delete({ where: { id: input.id } });
    return { success: true };
  });
