import "server-only";

import { ORPCError } from "@orpc/server";
import prisma from "@/lib/db";
import {
  limiteDoRecurso,
  ROTULO_DO_RECURSO,
  type RecursoLimitado,
} from "../lib/planos";
import { planoDaOrganizacao } from "./plano-da-organizacao";

/**
 * Limites de cadastro do plano.
 *
 * O erro carrega `data.code = "LIMITE_DO_PLANO"` e os números, no mesmo
 * padrão de `SaldoInsuficienteError`: o cliente reconhece pelo código e abre o
 * dialog de planos em vez de um toast genérico. O mapa de erros tipado do
 * projeto não tem `PAYMENT_REQUIRED`, e um código que o cliente não conhece
 * seria pior que `BAD_REQUEST` com dados.
 */
export interface DadosDoLimite {
  code: "LIMITE_DO_PLANO";
  recurso: RecursoLimitado;
  limite: number;
  atual: number;
  plano: string;
}

export class LimiteDoPlanoError extends ORPCError<
  "BAD_REQUEST",
  DadosDoLimite
> {
  constructor(dados: Omit<DadosDoLimite, "code">) {
    const rotulo = ROTULO_DO_RECURSO[dados.recurso];
    super("BAD_REQUEST", {
      message: `O plano ${dados.plano} permite até ${dados.limite} ${
        dados.limite === 1 ? rotulo.singular : rotulo.plural
      }. Escolha um plano para cadastrar mais.`,
      data: { code: "LIMITE_DO_PLANO", ...dados },
    });
  }
}

/**
 * Quantos há hoje, sem os dados de exemplo: o que foi semeado para a pessoa
 * conhecer o sistema não pode ser o que a impede de usá-lo.
 */
export async function contarRecurso(
  organizationId: string,
  recurso: RecursoLimitado,
): Promise<number> {
  switch (recurso) {
    case "produtos":
      return prisma.product.count({
        where: { organizationId, isDemo: false },
      });
    case "clientes":
      return prisma.customer.count({
        where: { organizationId, isDemo: false },
      });
    case "fornecedores":
      return prisma.supplier.count({
        where: { organizationId, isDemo: false },
      });
    case "lojas":
      return prisma.store.count({ where: { organizationId, isDemo: false } });
    case "membros": {
      // Convite pendente já ocupa a vaga: senão dá para convidar vinte e
      // deixar cada um entrar "por engano".
      const [membros, convites] = await Promise.all([
        prisma.member.count({ where: { organizationId } }),
        prisma.invitation.count({
          where: { organizationId, status: "pending" },
        }),
      ]);
      return membros + convites;
    }
  }
}

/**
 * Quantas vagas ainda cabem. `null` = ilimitado.
 *
 * Para quem cria em lote (importação), que precisa saber ANTES do laço quantas
 * linhas vão entrar — conferir a cada linha custaria uma contagem por
 * registro.
 */
export async function vagasRestantes(
  organizationId: string,
  recurso: RecursoLimitado,
): Promise<number | null> {
  const { plano } = await planoDaOrganizacao(organizationId);
  const limite = limiteDoRecurso(plano, recurso);
  if (limite === null) return null;
  const atual = await contarRecurso(organizationId, recurso);
  return Math.max(0, limite - atual);
}

/**
 * Lança `LimiteDoPlanoError` se `quantidadeNova` registros a mais estourarem
 * o plano. Plano sem limite para o recurso não faz consulta nenhuma além da
 * do plano.
 */
export async function assertDentroDoLimite(
  organizationId: string,
  recurso: RecursoLimitado,
  quantidadeNova = 1,
): Promise<void> {
  const { plano } = await planoDaOrganizacao(organizationId);
  const limite = limiteDoRecurso(plano, recurso);
  if (limite === null) return;

  const atual = await contarRecurso(organizationId, recurso);
  if (atual + quantidadeNova > limite) {
    throw new LimiteDoPlanoError({
      recurso,
      limite,
      atual,
      plano: plano.nome,
    });
  }
}
