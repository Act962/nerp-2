import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Define a thumbnail (foto principal) de um produto — a chave R2 já subida pelo
// client. Diferente de `set-images` (que só preenche a thumbnail se estiver
// vazia), aqui SOBRESCREVE de propósito: é a edição de foto pelo catálogo, que
// altera o produto no banco. A key também entra em `images` (sem duplicar).
// Multi-tenant: valida o produto pela org antes de escrever.
export const setProductThumbnail = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Definir a foto principal (thumbnail) de um produto",
    tags: ["products"],
  })
  .input(
    z.object({
      productId: z.string(),
      // Chave de objeto do bucket (não URL completa).
      key: z.string().min(1),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      thumbnail: z.string(),
      images: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
      select: { id: true, images: true },
    });
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });

    const images = product.images.includes(input.key)
      ? product.images
      : [input.key, ...product.images];

    const updated = await prisma.product.update({
      where: { id: input.productId },
      data: { thumbnail: input.key, images },
      select: { id: true, thumbnail: true, images: true },
    });

    return {
      id: updated.id,
      thumbnail: updated.thumbnail ?? "",
      images: updated.images,
    };
  });
