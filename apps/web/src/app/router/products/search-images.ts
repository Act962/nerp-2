import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  fetchCosmosImage,
  isCosmosConfigured,
} from "@/features/products/server/cosmos-image";
import {
  isImageSearchConfigured,
  searchWebProductImages,
} from "@/features/products/server/search-web-images";
import prisma from "@/lib/db";
import { z } from "zod";

// Busca imagens reais do produto para preencher a foto. Duas fontes:
//  A) Cosmos (Bluesoft): foto exata pelo código de barras — zero setup.
//  B) Google Custom Search: por nome, qualquer produto — precisa de
//     GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID.
// Devolve só URLs candidatas; o download/gravação é no "usar imagem".
export const searchProductImages = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Buscar imagens do produto na web",
    tags: ["products"],
  })
  .input(z.object({ productId: z.string() }))
  .output(z.object({ images: z.array(z.string()) }))
  .handler(async ({ input, context, errors }) => {
    if (!isCosmosConfigured() && !isImageSearchConfigured()) {
      throw errors.BAD_REQUEST({
        message:
          "Busca de imagem não configurada. Defina COSMOS_API_TOKEN ou GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID.",
      });
    }

    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
      select: { name: true, barcode: true },
    });
    if (!product) throw errors.NOT_FOUND({ message: "Produto não encontrado" });

    const images: string[] = [];

    // A) Cosmos — foto exata pelo código de barras (vem primeiro).
    if (product.barcode) {
      const cosmos = await fetchCosmosImage(product.barcode);
      if (cosmos) images.push(cosmos);
    }

    // B) Custom Search — por nome, complementa a lista.
    if (isImageSearchConfigured()) {
      const query = [product.name, product.barcode].filter(Boolean).join(" ");
      images.push(...(await searchWebProductImages(query)));
    }

    return { images: [...new Set(images)] };
  });
