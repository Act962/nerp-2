import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { ACOES_COBRAVEIS } from "@/features/stars/lib/acoes";
import { isOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

/**
 * O preço de cada ação cobrável.
 *
 * Devolve **todas** as ações do catálogo, com ou sem regra gravada: uma tela
 * que só lista o que já existe não deixa cadastrar o primeiro preço, e o
 * primeiro preço é justamente o que liga a cobrança.
 */
export const listRules = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Preços por ação", tags: ["Stars"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      podeEditar: z.boolean(),
      /** Nenhuma ação com preço = nada é cobrado nem bloqueado. */
      cobrancaAtiva: z.boolean(),
      regras: z.array(
        z.object({
          actionKey: z.string(),
          label: z.string(),
          descricao: z.string(),
          stars: z.number(),
          isActive: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const organizationId = context.org.id;

    const gravadas = await prisma.starRule.findMany({
      where: { organizationId },
      select: { actionKey: true, stars: true, isActive: true },
    });
    const porChave = new Map(gravadas.map((r) => [r.actionKey, r]));

    const regras = ACOES_COBRAVEIS.map((acao) => {
      const gravada = porChave.get(acao.actionKey);
      return {
        actionKey: acao.actionKey,
        label: acao.label,
        descricao: acao.descricao,
        stars: gravada?.stars ?? 0,
        isActive: gravada?.isActive ?? true,
      };
    });

    return {
      podeEditar: await isOrgAdmin(organizationId, context.user.id),
      cobrancaAtiva: regras.some((r) => r.isActive && r.stars > 0),
      regras,
    };
  });
