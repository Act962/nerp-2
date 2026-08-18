import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { z } from "zod";

// GLOBAL: sem requireOrgMiddleware de propósito. Qualquer usuário autenticado do
// sistema lê a Biblioteca Órbita inteira (dataset pequeno). O cliente agrupa por
// `code`.
export const listMediaModelPhotos = base
  .use(requireAuthMiddleware)
  .input(z.object({ code: z.string().optional() }).optional())
  .handler(async ({ input }) => {
    const items = await prisma.mediaModelPhoto.findMany({
      where: input?.code ? { code: input.code } : undefined,
      orderBy: [{ code: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, code: true, imageKey: true, sortOrder: true },
    });
    return { items };
  });
