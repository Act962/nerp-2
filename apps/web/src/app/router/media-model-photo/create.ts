import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { isSuperAdmin } from "@/lib/super-admin";
import { z } from "zod";

// Só o super-admin insere na biblioteca global — o gate real é aqui no
// servidor (o botão escondido no cliente é só UX).
export const createMediaModelPhoto = base
  .use(requireAuthMiddleware)
  .input(
    z.object({
      code: z.string().trim().min(1).max(6),
      imageKey: z.string().min(1),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({
        message: "Só o administrador do Órbita pode adicionar fotos globais",
      });
    }

    const last = await prisma.mediaModelPhoto.findFirst({
      where: { code: input.code.toUpperCase() },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const photo = await prisma.mediaModelPhoto.create({
      data: {
        code: input.code.toUpperCase(),
        imageKey: input.imageKey,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });

    return { id: photo.id };
  });
