import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { normalizeProductImage } from "@/features/planogram/server/normalize-product-image";
import {
  loadProductPhoto,
  storeNormalizedPhoto,
} from "@/features/planogram/server/product-photo-storage";
import prisma from "@/lib/db";
import { z } from "zod";

// Remove o fundo da foto ATUAL do produto e grava no cadastro. Reusa o mesmo
// motor do planograma (flood-fill a partir das bordas + recorte da moldura
// vazia, via sharp). Se o fundo não for uniforme o suficiente, o recorte sai
// "SUSPECT" e a foto original é preservada (applied=false).
export const removeProductBackground = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remover fundo da foto do produto",
    tags: ["products"],
  })
  .input(z.object({ productId: z.string() }))
  .output(
    z.object({
      thumbnail: z.string(),
      status: z.enum(["OK", "SUSPECT"]),
      reason: z.string().optional(),
      applied: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
      select: { id: true, thumbnail: true },
    });
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });
    if (!product.thumbnail) {
      throw errors.BAD_REQUEST({
        message: "Este produto ainda não tem foto para remover o fundo",
      });
    }

    let source: Buffer;
    try {
      source = await loadProductPhoto(product.thumbnail);
    } catch {
      throw errors.BAD_REQUEST({
        message: "Não consegui baixar a foto atual do produto",
      });
    }

    let normalized: Awaited<ReturnType<typeof normalizeProductImage>>;
    try {
      normalized = await normalizeProductImage(source);
    } catch {
      throw errors.BAD_REQUEST({
        message: "Não consegui processar a foto atual. Envie outra imagem.",
      });
    }

    // Fundo não uniforme: não substitui — perderia a única foto por um recorte
    // duvidoso. Devolve a original com o motivo.
    if (normalized.status === "SUSPECT") {
      return {
        thumbnail: product.thumbnail,
        status: normalized.status,
        reason: normalized.reason,
        applied: false,
      };
    }

    const key = await storeNormalizedPhoto(normalized.buffer);
    await prisma.product.update({
      where: { id: input.productId },
      data: { thumbnail: key },
    });

    return { thumbnail: key, status: normalized.status, applied: true };
  });
