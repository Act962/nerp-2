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

// Recorta a foto que JÁ está no cadastro, sem exigir upload.
//
// É o caso comum: o produto veio do catálogo ou de uma importação com foto de
// fundo branco, e o planograma desenha a proporção do ARQUIVO — logo um
// quadrado branco na prateleira em vez da silhueta da embalagem. Mandar o
// usuário reencontrar a foto original só para reenviá-la seria trabalho
// inventado.
//
// Diferente do upload, aqui o cadastro só é alterado quando o recorte sai
// confiável: em SUSPECT a foto original continua sendo a do produto, porque
// substituí-la perderia a única imagem que existe em troca de um recorte que
// pode ter comido a embalagem.

export const recutProductPhoto = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ productId: z.string() }))
  .output(
    z.object({
      thumbnail: z.string(),
      widthPx: z.number(),
      heightPx: z.number(),
      status: z.enum(["OK", "SUSPECT"]),
      reason: z.string().optional(),
      keyedBackground: z.boolean(),
      /** Falso quando o recorte saiu duvidoso e o cadastro foi preservado. */
      applied: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, organizationId: context.org.id },
      select: { id: true, thumbnail: true },
    });
    if (!product) {
      throw errors.NOT_FOUND({ message: "Produto não encontrado" });
    }
    if (!product.thumbnail) {
      throw errors.BAD_REQUEST({
        message: "Este produto ainda não tem foto para recortar",
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
        message: "Não consegui ler a foto atual. Envie outra imagem.",
      });
    }

    if (normalized.status === "SUSPECT") {
      return {
        thumbnail: product.thumbnail,
        widthPx: normalized.widthPx,
        heightPx: normalized.heightPx,
        status: normalized.status,
        reason: normalized.reason,
        keyedBackground: normalized.keyedBackground,
        applied: false,
      };
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
      applied: true,
    };
  });
