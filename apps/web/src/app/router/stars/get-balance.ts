import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { limiteDeStars } from "@/features/billing/lib/planos";
import { planoDaOrganizacao } from "@/features/billing/server/plano-da-organizacao";
import { emEstrelas } from "@/features/stars/lib/decimal";
import { calcularUso } from "@/features/stars/lib/uso";
import { garantirCreditoDoCiclo } from "@/features/stars/server/credito-do-ciclo";
import { ACOES, custoDaAcao } from "@/features/stars/server/debitar";
import prisma from "@/lib/db";

/**
 * Saldo, uso do plano e o que cada ação custa.
 *
 * Devolve junto o preço de cada ação porque a tela precisa dizer quantas
 * mensagens ainda cabem — saldo sozinho não significa nada para quem não sabe
 * quanto custa mandar uma.
 *
 * Confere o crédito do ciclo antes de ler: é a leitura da sidebar, então é o
 * primeiro lugar em que alguém "precisa" do crédito do mês.
 *
 * `cobrancaAtiva` fala só do WhatsApp — o Astro é sempre cobrado. A tela usa
 * isso para explicar que mensagens ainda não custam nada, sem esconder que o
 * Astro custa.
 */
export const getBalance = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Saldo de ★", tags: ["Stars"] })
  .input(z.object({}))
  .output(
    z.object({
      saldo: z.number(),
      cobrancaAtiva: z.boolean(),
      precos: z.object({
        mensagem: z.number(),
        campanha: z.number(),
        astroPor1k: z.number(),
      }),
      mensagensRestantes: z.number().nullable(),
      plano: z.object({
        id: z.string(),
        nome: z.string(),
        gratuito: z.boolean(),
        origem: z.enum(["assinatura", "legado", "gratis"]),
      }),
      limite: z.number(),
      consumido: z.number(),
      percentual: z.number(),
      usoExtra: z.number(),
      restanteDoPlano: z.number(),
      nivel: z.enum(["ok", "atencao", "critico", "esgotado"]),
    }),
  )
  .handler(async ({ context }) => {
    const organizationId = context.org.id;

    await garantirCreditoDoCiclo(organizationId);

    const [org, mensagem, campanha, astroPor1k, { plano, origem }] =
      await Promise.all([
        prisma.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: { starsBalance: true, starsUsedInCycle: true },
        }),
        custoDaAcao(organizationId, ACOES.mensagemEnviada),
        custoDaAcao(organizationId, ACOES.destinatarioDeCampanha),
        custoDaAcao(organizationId, ACOES.astroTokens),
        planoDaOrganizacao(organizationId),
      ]);

    const uso = calcularUso({
      saldo: emEstrelas(org.starsBalance),
      limite: limiteDeStars(plano),
      consumido: emEstrelas(org.starsUsedInCycle),
    });

    return {
      saldo: emEstrelas(org.starsBalance),
      cobrancaAtiva: mensagem > 0 || campanha > 0,
      precos: { mensagem, campanha, astroPor1k },
      mensagensRestantes:
        mensagem > 0
          ? Math.floor(emEstrelas(org.starsBalance) / mensagem)
          : null,
      plano: {
        id: plano.id,
        nome: plano.nome,
        gratuito: plano.gratuito,
        origem,
      },
      limite: uso.limite,
      consumido: uso.consumido,
      percentual: uso.percentual,
      usoExtra: uso.usoExtra,
      restanteDoPlano: uso.restanteDoPlano,
      nivel: uso.nivel,
    };
  });
