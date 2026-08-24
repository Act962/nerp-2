import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";

// Fotos (thumbnail) atuais de produtos do cadastro, por id. Usado pela aba
// "Lista" para reconciliar a foto das linhas casadas com o que está no banco
// (o snapshot da linha pode ficar defasado quando a foto muda no cadastro).
export const productThumbnails = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Fotos (thumbnail) de produtos por id",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ ids: z.array(z.string()).max(1000) }))
  .output(z.array(z.object({ id: z.string(), thumbnail: z.string() })))
  .handler(async ({ input, context }) => {
    if (input.ids.length === 0) return [];
    const prods = await prisma.product.findMany({
      where: { id: { in: input.ids }, organizationId: context.org.id },
      select: { id: true, thumbnail: true },
    });
    return prods.map((p) => ({ id: p.id, thumbnail: p.thumbnail ?? "" }));
  });
