import type { RecursoLimitado } from "./planos";

/**
 * O que o servidor manda junto com `LimiteDoPlanoError` (`server/limites.ts`).
 * Módulo neutro: o cliente lê daqui sem puxar o `server-only`.
 */
export interface DadosDoLimite {
  code: "LIMITE_DO_PLANO";
  recurso: RecursoLimitado;
  limite: number;
  atual: number;
  plano: string;
}

/**
 * Reconhece o erro de limite pelo código nos dados, seja qual for a classe
 * que o cliente oRPC entregou — é o `data.code` que o servidor promete, não
 * o tipo.
 */
export function lerLimiteDoPlano(erro: unknown): DadosDoLimite | null {
  if (typeof erro !== "object" || erro === null || !("data" in erro)) {
    return null;
  }
  const dados = (erro as { data?: unknown }).data;
  if (typeof dados !== "object" || dados === null) return null;
  const candidato = dados as Partial<DadosDoLimite>;
  if (candidato.code !== "LIMITE_DO_PLANO") return null;
  if (
    typeof candidato.recurso !== "string" ||
    typeof candidato.limite !== "number" ||
    typeof candidato.atual !== "number" ||
    typeof candidato.plano !== "string"
  ) {
    return null;
  }
  return {
    code: "LIMITE_DO_PLANO",
    recurso: candidato.recurso,
    limite: candidato.limite,
    atual: candidato.atual,
    plano: candidato.plano,
  };
}
