import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ACOES_COBRAVEIS } from "@/features/stars/lib/acoes";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";

/**
 * Define quanto uma ação custa em ★.
 *
 * É a chave que **liga a cobrança**: enquanto nenhuma ação tem preço,
 * `custoDaAcao` devolve 0 e nada é debitado nem bloqueado. Por isso só
 * administrador mexe — é a diferença entre a loja enviar mensagem à vontade e
 * a loja parar de enviar por falta de saldo.
 *
 * Preço zero é a forma de desligar de novo, e é o valor de quem nunca
 * cadastrou: um único caminho para "não cobra esta ação", em vez de "não tem
 * linha" e "tem linha valendo zero" significando a mesma coisa por dois
 * caminhos diferentes.
 */
export const setRule = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Define o preço de uma ação",
    tags: ["Stars"],
  })
  .input(
    z.object({
      actionKey: z.string().min(1),
      /** ★ por ação. Zero desliga a cobrança dela. */
      stars: z.number().int().min(0).max(1000),
    }),
  )
  .output(
    z.object({
      actionKey: z.string(),
      stars: z.number(),
      cobrancaAtiva: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;

    if (!(await isOrgAdmin(organizationId, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem mudar o preço das ações.",
      });
    }

    // A chave vem do cliente e precisa existir no catálogo: sem esta
    // conferência dava para gravar preço para uma ação que ninguém cobra —
    // uma linha órfã que só aparece confundindo quem for auditar a fatura.
    const acao = ACOES_COBRAVEIS.find(
      (item) => item.actionKey === input.actionKey,
    );
    if (!acao) {
      throw errors.NOT_FOUND({ message: "Ação desconhecida" });
    }

    await prisma.starRule.upsert({
      where: {
        organizationId_actionKey: { organizationId, actionKey: acao.actionKey },
      },
      create: {
        organizationId,
        actionKey: acao.actionKey,
        label: acao.label,
        stars: input.stars,
      },
      update: { stars: input.stars, label: acao.label, isActive: true },
    });

    const comPreco = await prisma.starRule.count({
      where: { organizationId, isActive: true, stars: { gt: 0 } },
    });

    return {
      actionKey: acao.actionKey,
      stars: input.stars,
      cobrancaAtiva: comPreco > 0,
    };
  });
