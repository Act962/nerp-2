import {
  custoDaResposta,
  modeloPorId,
  MODELOS,
} from "@/features/astro/server/modelos";

/**
 * O gasto com o provedor de IA, somado a partir do que o nerp registrou.
 *
 * **Não existe "saldo do Gemini" para ler.** A API de IA do Google não expõe
 * endpoint de saldo nem de fatura — quem tem esse dado é o Cloud Billing, com
 * outra credencial e outro escopo. Então a fonte aqui é a nossa: cada sessão
 * de conversa guarda os tokens e o modelo que respondeu, e a tabela de preço
 * de `astro/server/modelos.ts` transforma isso em dólar.
 *
 * É estimativa, e a tela diz isso. Mas é estimativa pela MESMA tabela que
 * cobra o cliente — o que dá a ela a propriedade que importa: se a margem de
 * 50% está de pé, o que entrou em ★ cobre o que saiu em dólar.
 *
 * Módulo puro: recebe as linhas já lidas e devolve números.
 */

export type SessaoContabilizada = {
  modelo: string | null;
  tokensIn: number;
  tokensOut: number;
};

export type GastoDoProvedor = {
  custoDolar: number;
  custoReal: number;
  tokensIn: number;
  tokensOut: number;
  /** Quantas sessões entraram na conta. */
  sessoes: number;
  /**
   * Sessões sem modelo registrado — as anteriores a passarmos a gravá-lo.
   * Entram nos tokens e ficam FORA do custo, porque preço sem modelo é chute.
   */
  semModelo: number;
};

/**
 * O modelo é gravado pelo `nome` da tabela ("Flash-Lite 3.1"), e não pelo id.
 * Aceitar os dois evita que um ajuste na rota desligue a conta em silêncio.
 */
function acharModelo(chave: string) {
  return (
    modeloPorId(chave) ??
    MODELOS.find((modelo) => modelo.nome === chave) ??
    null
  );
}

export function somarGastoDoProvedor(
  sessoes: readonly SessaoContabilizada[],
  dolar: number,
): GastoDoProvedor {
  let custoDolar = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let semModelo = 0;

  for (const sessao of sessoes) {
    tokensIn += Math.max(0, sessao.tokensIn);
    tokensOut += Math.max(0, sessao.tokensOut);

    const modelo = sessao.modelo ? acharModelo(sessao.modelo) : null;
    if (!modelo) {
      semModelo += 1;
      continue;
    }

    custoDolar += custoDaResposta({
      modelo,
      tokensIn: sessao.tokensIn,
      tokensOut: sessao.tokensOut,
      // Margem 1: aqui se quer o CUSTO, não o preço.
      base: { dolar: 1, realPorEstrela: 1, margem: 1 },
    }).custoDolar;
  }

  return {
    custoDolar,
    custoReal: custoDolar * Math.max(0, dolar),
    tokensIn,
    tokensOut,
    sessoes: sessoes.length,
    semModelo,
  };
}

/**
 * Quanto sobrou do orçamento do mês.
 *
 * O orçamento é digitado na configuração do Astro, porque ninguém consegue
 * lê-lo do provedor. Sem orçamento, `null` — e a tela mostra só o gasto, sem
 * inventar um teto.
 */
export function saldoDoOrcamento(
  gastoReal: number,
  orcamentoReal: number,
): { restante: number; percentual: number } | null {
  if (orcamentoReal <= 0) return null;
  const restante = orcamentoReal - gastoReal;
  return {
    restante,
    percentual: Math.min(100, Math.round((gastoReal / orcamentoReal) * 100)),
  };
}
