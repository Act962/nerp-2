import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { isSuperAdmin } from "@/lib/super-admin";
import { z } from "zod";

export const deleteMediaModelPhoto = base
  .use(requireAuthMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({
        message: "Só o administrador do Órbita pode apagar fotos globais",
      });
    }

    const existing = await prisma.mediaModelPhoto.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Foto não encontrada" });
    }

    return prisma.mediaModelPhoto.delete({ where: { id: input.id } });
  });
