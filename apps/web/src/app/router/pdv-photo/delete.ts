import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const deletePdvPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const photo = await prisma.pdvPhoto.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!photo) {
      throw errors.NOT_FOUND({ message: "Foto do PDV não encontrada" });
    }

    return prisma.pdvPhoto.delete({ where: { id: input.id } });
  });
