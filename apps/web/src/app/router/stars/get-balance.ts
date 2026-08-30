import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ACOES, custoDaAcao } from "@/features/stars/server/debitar";
import prisma from "@/lib/db";

/**
 * Saldo e o que ele custa.
 *
 * Devolve junto o preço de cada ação porque a tela precisa dizer quantas
 * mensagens ainda cabem — saldo sozinho não significa nada para quem não sabe
 * quanto custa mandar uma.
 *
 * `cobrancaAtiva: false` quando nenhuma ação tem preço: é o estado padrão, e a
 * tela usa isso para dizer que a cobrança está desligada em vez de exibir um
 * saldo zerado que assustaria à toa.
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
      precos: z.object({ mensagem: z.number(), campanha: z.number() }),
      mensagensRestantes: z.number().nullable(),
    }),
  )
  .handler(async ({ context }) => {
    const organizationId = context.org.id;

    const [org, mensagem, campanha] = await Promise.all([
      prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { starsBalance: true },
      }),
      custoDaAcao(organizationId, ACOES.mensagemEnviada),
      custoDaAcao(organizationId, ACOES.destinatarioDeCampanha),
    ]);

    const cobrancaAtiva = mensagem > 0 || campanha > 0;

    return {
      saldo: org.starsBalance,
      cobrancaAtiva,
      precos: { mensagem, campanha },
      mensagensRestantes:
        mensagem > 0 ? Math.floor(org.starsBalance / mensagem) : null,
    };
  });
