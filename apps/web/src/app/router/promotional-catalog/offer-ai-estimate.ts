import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { emEstrelas } from "@/features/stars/lib/decimal";
import {
  estimarGeracao,
  iaDisponivel,
} from "@/features/promotional-catalog/server/gerar-oferta";
import {
  logoDisponivel,
  precoDoLogo,
} from "@/features/promotional-catalog/server/gerar-logo";
import { precoDaArte } from "@/features/promotional-catalog/server/gerar-arte";

const NIVEIS = ["ECONOMICO", "EQUILIBRADO", "PREMIUM"] as const;

// O que o passo "Gerar" do assistente mostra: ★ estimadas por nível, o saldo,
// o nível padrão da organização e se há IA (chave da OpenAI) no ar.
export const offerAiEstimate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Estimativa de ★ do gerador de oferta com IA",
    tags: ["promotional-catalog"],
  })
  .input(z.object({ produtos: z.number().int().min(1).max(60) }))
  .output(
    z.object({
      disponivel: z.boolean(),
      saldo: z.number(),
      nivelPadrao: z.enum(NIVEIS),
      estimativas: z.record(z.enum(NIVEIS), z.number()),
      logoDisponivel: z.boolean(),
      logo: z.record(z.enum(NIVEIS), z.number()),
      arte: z.record(z.enum(NIVEIS), z.number()),
    }),
  )
  .handler(async ({ input, context }) => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: context.org.id },
      select: { starsBalance: true, aiOfferLevel: true },
    });
    const [valores, logos, artes] = await Promise.all([
      Promise.all(
        NIVEIS.map((n) => estimarGeracao(context.org.id, n, input.produtos)),
      ),
      Promise.all(NIVEIS.map((n) => precoDoLogo(context.org.id, n))),
      Promise.all(NIVEIS.map((n) => precoDaArte(context.org.id, n))),
    ]);
    return {
      disponivel: iaDisponivel("EQUILIBRADO"),
      saldo: emEstrelas(org.starsBalance),
      nivelPadrao: org.aiOfferLevel,
      estimativas: {
        ECONOMICO: valores[0],
        EQUILIBRADO: valores[1],
        PREMIUM: valores[2],
      },
      logoDisponivel: logoDisponivel(),
      logo: { ECONOMICO: logos[0], EQUILIBRADO: logos[1], PREMIUM: logos[2] },
      arte: { ECONOMICO: artes[0], EQUILIBRADO: artes[1], PREMIUM: artes[2] },
    };
  });
