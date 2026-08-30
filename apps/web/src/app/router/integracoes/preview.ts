import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  decifrarCredenciais,
  sanitizarErro,
} from "@/features/integracoes/server/credentials";
import { criarConector } from "@/features/integracoes/server/resolve-connector";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";

const DIAS_DA_PREVIA = 30;
const LIMITE_LINHAS = 100;

// Prévia do extrato — é o que prova, para quem instalou, que a credencial está
// puxando dado de verdade. NÃO persiste lançamento: gravar depende do modelo de
// conta que `financeiro-contas` ainda não decidiu, e uma terceira verdade sobre
// "conta" seria pior que esperar.
export const previewIntegracao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Prévia do extrato de uma integração instalada",
    tags: ["integracoes"],
  })
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const integracao = await prisma.financialIntegration.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, providerId: true, credentialsCiphertext: true },
    });

    if (!integracao) {
      throw errors.NOT_FOUND({ message: "Integração não encontrada." });
    }
    if (!integracao.credentialsCiphertext) {
      throw errors.BAD_REQUEST({
        message: "Esta integração está sem credenciais configuradas.",
      });
    }

    const valores = decifrarCredenciais(integracao.credentialsCiphertext);
    const conector = criarConector(integracao.providerId, valores);

    if (!conector.buscarExtrato) {
      throw errors.BAD_REQUEST({
        message: "Este provedor não fornece extrato.",
      });
    }

    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - DIAS_DA_PREVIA);

    try {
      const movimentos = await conector.buscarExtrato({ from, to });
      await prisma.financialIntegration.update({
        where: { id: integracao.id },
        data: { lastSyncAt: new Date(), lastSyncError: null, status: "ACTIVE" },
      });
      return {
        ok: true as const,
        dias: DIAS_DA_PREVIA,
        total: movimentos.length,
        movimentos: movimentos.slice(0, LIMITE_LINHAS),
      };
    } catch (error) {
      const mensagem = sanitizarErro(
        (error as Error).message,
        Object.values(valores),
      );
      await prisma.financialIntegration.update({
        where: { id: integracao.id },
        data: { status: "ERROR", lastSyncError: mensagem },
      });
      return {
        ok: false as const,
        dias: DIAS_DA_PREVIA,
        total: 0,
        movimentos: [],
        mensagem,
      };
    }
  });
