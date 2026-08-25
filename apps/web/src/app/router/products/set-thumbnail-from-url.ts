import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { uploadImageFromUrl } from "@/features/products/server/upload-image-from-url";
import prisma from "@/lib/db";
import { z } from "zod";

// Baixa a imagem de uma URL (varredura da web) e grava como thumbnail do
// produto NO BANCO. Reusa `uploadImageFromUrl` (valida content-type/tamanho/
// timeout + sobe pro R2). Multi-tenant: valida o produto pela org.
export const setProductThumbnailFromUrl = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Definir thumbnail do produto a partir de uma URL",
    tags: ["products"],
  })
  .input(z.object({ productId: z.string(), url: z.string().url() }))
  .output(z.object({ id: z.string(), thumbnail: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
      select: { id: true, images: true },
    });
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });

    const key = await uploadImageFromUrl(input.url);
    if (!key) {
      throw errors.BAD_REQUEST({
        message: "Não foi possível baixar a imagem dessa URL.",
      });
    }

    const images = product.images.includes(key)
      ? product.images
      : [key, ...product.images];

    const updated = await prisma.product.update({
      where: { id: input.productId },
      data: { thumbnail: key, images },
      select: { id: true, thumbnail: true },
    });

    return { id: updated.id, thumbnail: updated.thumbnail ?? "" };
  });
