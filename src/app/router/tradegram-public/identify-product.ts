import { base } from "@/app/middlewares/base";
import { identifyProductFromImage } from "@/features/shopper/server/identify-product-vision";
import prisma from "@/lib/db";
import { z } from "zod";
import { resolvePublicStore } from "./_resolve-public-store";

// ~1.5MB de base64 (a imagem já vem reduzida do cliente). Barra payload abusivo.
const MAX_BASE64 = 2_000_000;

// Rate-limit best-effort por anonId (memória do processo). Protege o custo do
// endpoint público de IA. Produção com múltiplas instâncias precisa de um
// limiter durável (ex.: Upstash) — TODO.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

function isRateLimited(anonId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(anonId) ?? []).filter((ts) => now - ts < WINDOW_MS);
  recent.push(now);
  hits.set(anonId, recent);
  return recent.length > MAX_PER_WINDOW;
}

// Identifica um produto por FOTO (IA de visão) e casa com o catálogo da loja.
// Não achou / IA sem chave / sem confiança → { found:false } e o app mostra
// "não identificamos o produto, escaneie o código de barras".
export const identifyProduct = base
  .route({ method: "POST", summary: "Identificar produto por foto (IA)" })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      storeId: z.string().min(1),
      anonId: z.string().min(1).max(64),
      imageBase64: z.string().min(1).max(MAX_BASE64),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    }),
  )
  .handler(async ({ input, errors }) => {
    if (isRateLimited(input.anonId)) {
      throw errors.BAD_REQUEST({ message: "Muitas tentativas. Aguarde." });
    }

    const { organizationId } = await resolvePublicStore(
      input.orgSlug,
      input.storeId,
      errors,
    );

    const guess = await identifyProductFromImage(
      input.imageBase64,
      input.mimeType,
    );
    if (!guess || !guess.confident) return { found: false as const };

    // Casa do termo mais específico ao mais genérico; primeiro que bater vence.
    // Só produtos COM código de barras (o cliente segue pra página do produto).
    const terms = [...guess.searchTerms, guess.name, guess.brand].filter(
      (term): term is string => Boolean(term?.trim()),
    );

    let matched: { barcode: string | null; name: string } | null = null;
    for (const term of terms) {
      const product = await prisma.product.findFirst({
        where: {
          organizationId,
          isActive: true,
          barcode: { not: null },
          name: { contains: term.trim(), mode: "insensitive" },
        },
        orderBy: { name: "asc" },
        select: { barcode: true, name: true },
      });
      if (product?.barcode) {
        matched = { barcode: product.barcode, name: product.name };
        break;
      }
    }

    await prisma.scanEvent.create({
      data: {
        organizationId,
        storeId: input.storeId,
        kind: "PRODUCT_SEARCH",
        barcode: matched?.barcode ?? null,
        query: guess.name ?? guess.brand ?? null,
        matched: Boolean(matched),
        anonId: input.anonId,
      },
    });

    if (!matched?.barcode) return { found: false as const };
    return {
      found: true as const,
      barcode: matched.barcode,
      name: matched.name,
    };
  });
