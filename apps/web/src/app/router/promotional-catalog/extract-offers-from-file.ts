import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { extractOffersFromImage } from "@/features/promotional-catalog/server/extract-offers-vision";

// Extrai ofertas de um PDF/imagem (base64) via IA (Gemini). A aba "Lista" usa
// isto quando o arquivo não é planilha.
export const extractOffersFromFile = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Extrair ofertas de PDF/imagem por IA",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      // base64 do arquivo (~≤8MB → ~11MB de base64).
      base64: z.string().min(1).max(12_000_000),
      mimeType: z.string().min(1),
    }),
  )
  .output(
    z.object({
      offers: z.array(
        z.object({
          client: z.string().nullable(),
          productName: z.string(),
          normalPrice: z.number().nullable(),
          offerPrice: z.number().nullable(),
          department: z.string().nullable(),
          startDate: z.string().nullable(),
          endDate: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, errors }) => {
    const offers = await extractOffersFromImage(input.base64, input.mimeType);
    if (offers === null) {
      throw errors.BAD_REQUEST({
        message:
          "Não consegui ler as ofertas do arquivo. Verifique a chave da IA (OPENAI_API_KEY ou GEMINI_API_KEY) ou use uma planilha.",
      });
    }
    return { offers };
  });
