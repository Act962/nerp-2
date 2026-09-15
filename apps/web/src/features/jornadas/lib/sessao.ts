/**
 * A jornada em andamento, gravada no `sessionStorage`.
 *
 * Precisa sobreviver à navegação e ao F5 — uma jornada que ensina a cadastrar
 * produto atravessa três telas —, e o estado do React morre nas duas. É
 * `sessionStorage` e não `localStorage` de propósito: jornada é coisa de agora,
 * e reencontrá-la parada no meio duas semanas depois seria só confusão.
 *
 * O `Storage` entra por parâmetro para o módulo ser testável fora do navegador.
 */

export const CHAVE_DA_SESSAO = "nerp:jornada:ativa";

const VERSAO = 1;

export interface JornadaEmAndamento {
  versao: number;
  jornadaId: string;
  /**
   * A empresa em que ela começou. Trocar de empresa no meio encerra a jornada:
   * o menu, as permissões e o saldo passam a ser de outra operação.
   */
  organizationId: string;
  passo: number;
  /** ISO do relógio do SERVIDOR, devolvido por `jornadas.iniciar`. */
  iniciadaEm: string;
  /** `Date.now()` de quando o passo atual apareceu. Null enquanto procura o alvo. */
  passoMostradoEm: number | null;
  /** Milissegundos gastos em cada passo já concluído. */
  tempos: number[];
  apressos: number;
  /** Em que passo a fala de pressa já apareceu — ela vem uma vez por passo. */
  avisouPressaNoPasso: number | null;
}

export function lerSessao(storage: Storage | null): JornadaEmAndamento | null {
  if (!storage) return null;
  try {
    const bruto = storage.getItem(CHAVE_DA_SESSAO);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<JornadaEmAndamento>;
    // Versão diferente é formato de outra entrega: descartar é mais barato do
    // que migrar um estado que dura uma aba.
    if (dados.versao !== VERSAO) return null;
    if (
      typeof dados.jornadaId !== "string" ||
      typeof dados.organizationId !== "string" ||
      typeof dados.passo !== "number" ||
      typeof dados.iniciadaEm !== "string"
    ) {
      return null;
    }
    return {
      versao: VERSAO,
      jornadaId: dados.jornadaId,
      organizationId: dados.organizationId,
      passo: dados.passo,
      iniciadaEm: dados.iniciadaEm,
      passoMostradoEm:
        typeof dados.passoMostradoEm === "number"
          ? dados.passoMostradoEm
          : null,
      tempos: Array.isArray(dados.tempos) ? dados.tempos : [],
      apressos: typeof dados.apressos === "number" ? dados.apressos : 0,
      avisouPressaNoPasso:
        typeof dados.avisouPressaNoPasso === "number"
          ? dados.avisouPressaNoPasso
          : null,
    };
  } catch {
    // Storage bloqueado (janela anônima) ou JSON corrompido: sem jornada
    // retomada é bem melhor do que uma tela que não carrega.
    return null;
  }
}

export function gravarSessao(
  storage: Storage | null,
  sessao: JornadaEmAndamento | null,
): void {
  if (!storage) return;
  try {
    if (sessao === null) {
      storage.removeItem(CHAVE_DA_SESSAO);
      return;
    }
    storage.setItem(CHAVE_DA_SESSAO, JSON.stringify(sessao));
  } catch {}
}

export function novaSessao(input: {
  jornadaId: string;
  organizationId: string;
  iniciadaEm: string;
}): JornadaEmAndamento {
  return {
    versao: VERSAO,
    jornadaId: input.jornadaId,
    organizationId: input.organizationId,
    passo: 0,
    iniciadaEm: input.iniciadaEm,
    passoMostradoEm: null,
    tempos: [],
    apressos: 0,
    avisouPressaNoPasso: null,
  };
}

/** O `sessionStorage` quando ele existe. No servidor, e em janela que o bloqueia, é `null`. */
export function storageDaSessao(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
