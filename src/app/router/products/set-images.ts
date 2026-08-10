import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Grava a lista de imagens de um produto (keys do R2). Usado pelo assistente
// de importação em massa por SKU — após subir os arquivos, o client chama
// esta procedure uma vez por produto. Multi-tenant: valida o produto pela org
// antes de escrever (evita cross-tenant leak via id enviado).
export const setProductImages = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      productId: z.string(),
      // `keys` são as chaves de objeto do bucket (não URLs completas).
      keys: z.array(z.string().min(1)).min(1).max(20),
      // Modo: "replace" apaga o que havia; "append" mantém e adiciona.
      // Default = "append" (não perde o que o operador subiu antes).
      mode: z.enum(["replace", "append"]).optional(),
      // Se true, define o primeiro `keys[0]` como thumbnail — só se o produto
      // ainda não tem thumbnail (não sobrescreve o escolhido manualmente).
      setThumbnailIfEmpty: z.boolean().optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      images: z.array(z.string()),
      thumbnail: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
      select: { id: true, images: true, thumbnail: true },
    });
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });

    const mode = input.mode ?? "append";
    const nextImages =
      mode === "replace" ? input.keys : [...product.images, ...input.keys];
    // Deduplicação (mesma imagem enviada 2x não gera 2 entradas).
    const uniqueImages = [...new Set(nextImages)];

    const shouldSetThumb =
      input.setThumbnailIfEmpty && !product.thumbnail && input.keys[0];

    const updated = await prisma.product.update({
      where: { id: input.productId },
      data: {
        images: uniqueImages,
        ...(shouldSetThumb ? { thumbnail: input.keys[0] } : {}),
      },
      select: { id: true, images: true, thumbnail: true },
    });

    return {
      id: updated.id,
      images: updated.images,
      thumbnail: updated.thumbnail ?? "",
    };
  });
