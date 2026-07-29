import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { normalizeProductImage } from "@/features/planogram/server/normalize-product-image";
import { storeNormalizedPhoto } from "@/features/planogram/server/product-photo-storage";
import prisma from "@/lib/db";
import { z } from "zod";

// Recebe a foto já reduzida no cliente (compressImage, borda máx. 1400px),
// recorta o fundo e grava como thumbnail do produto.
//
// Síncrono de propósito: o recorte de uma imagem de 1400px leva ~200ms, então
// mandar para fila só adicionaria latência e estado. O limite de tamanho da
// entrada é o que garante esse tempo — sem ele uma foto de 12MP travaria a
// função.

const MAX_BASE64_BYTES = 6 * 1024 * 1024;

export const normalizeProductPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      productId: z.string(),
      /** Conteúdo da imagem em base64, sem o prefixo data:. */
      imageBase64: z.string().max(MAX_BASE64_BYTES),
    }),
  )
  .output(
    z.object({
      thumbnail: z.string(),
      widthPx: z.number(),
      heightPx: z.number(),
      status: z.enum(["OK", "SUSPECT"]),
      reason: z.string().optional(),
      keyedBackground: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
      select: { id: true },
    });
    if (!product) {
      throw errors.NOT_FOUND({ message: "Produto não encontrado" });
    }

    const source = Buffer.from(input.imageBase64, "base64");
    if (source.byteLength === 0) {
      throw errors.BAD_REQUEST({ message: "Imagem vazia" });
    }

    let normalized: Awaited<ReturnType<typeof normalizeProductImage>>;
    try {
      normalized = await normalizeProductImage(source);
    } catch {
      throw errors.BAD_REQUEST({
        message: "Não consegui ler essa imagem. Tente outro arquivo.",
      });
    }

    const key = await storeNormalizedPhoto(normalized.buffer);

    await prisma.product.update({
      where: { id: input.productId },
      data: { thumbnail: key },
    });

    return {
      thumbnail: key,
      widthPx: normalized.widthPx,
      heightPx: normalized.heightPx,
      status: normalized.status,
      reason: normalized.reason,
      keyedBackground: normalized.keyedBackground,
    };
  });
