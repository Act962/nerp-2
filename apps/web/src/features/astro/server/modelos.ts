/**
 * Quanto cada modelo custa, e quanto a gente cobra por isso.
 *
 * **Esta tabela é a fonte única do preço.** O valor em ★ de uma resposta sai
 * daqui, do total de tokens e da margem — não de um número digitado à mão que
 * envelhece em silêncio. Subiu na Google, muda-se UMA linha aqui e a cobrança
 * acompanha, sem ninguém ter de lembrar de reajustar nada.
 *
 * Os preços são os do provedor, em dólar por MIL tokens, com entrada e saída
 * separadas — a saída custa de quatro a seis vezes mais, e uma média entre as
 * duas erraria para menos em toda resposta longa, que é justamente a cara.
 *
 * Módulo neutro, sem `server-only`: a calculadora da tela de Stars lê a mesma
 * tabela. Duas tabelas dariam dois preços para a mesma resposta.
 */

/** Os três níveis de dificuldade que o Astro sabe distinguir. */
export const NIVEIS = ["leve", "medio", "pesado"] as const;
export type Nivel = (typeof NIVEIS)[number];

/**
 * A margem sobre o custo do provedor. **Fixa, e é decisão de negócio.**
 *
 * Multiplicador e não valor absoluto: é o que faz o reajuste da Google chegar
 * ao preço sozinho. Mexer aqui muda o preço de todas as organizações no
 * próximo deploy, e é para ser assim — margem que se configura por cliente
 * vira tabela de exceções que ninguém audita.
 */
export const MARGEM = 1.5;

export type ModeloDef = {
  /** O id que vai para o provedor. */
  id: string;
  nome: string;
  nivel: Nivel;
  /** US$ por 1.000 tokens de ENTRADA. */
  entradaPor1k: number;
  /** US$ por 1.000 tokens de SAÍDA. */
  saidaPor1k: number;
};

/**
 * O catálogo, do mais barato ao mais caro.
 *
 * Preços conferidos com o dev em 2026-09-11, para contexto até 200k. Acima
 * disso a Google cobra mais, e esta tabela não distingue — é uma simplificação
 * conhecida, e a favor do cliente, não contra.
 */
export const MODELOS: ModeloDef[] = [
  {
    id: "gemini-2.5-flash-lite",
    nome: "Flash-Lite 2.5",
    nivel: "leve",
    entradaPor1k: 0.0001,
    saidaPor1k: 0.0004,
  },
  {
    id: "gemini-3.1-flash-lite",
    nome: "Flash-Lite 3.1",
    nivel: "leve",
    entradaPor1k: 0.00025,
    saidaPor1k: 0.0015,
  },
  {
    id: "gemini-3.5-flash",
    nome: "Flash 3.5",
    nivel: "medio",
    entradaPor1k: 0.0015,
    saidaPor1k: 0.009,
  },
  {
    id: "gemini-3.1-pro",
    nome: "Pro 3.1",
    nivel: "pesado",
    entradaPor1k: 0.002,
    saidaPor1k: 0.012,
  },
];

/**
 * Qual modelo atende cada nível.
 *
 * O leve é o Flash-Lite 3.1, e não o 2.5, de propósito: a diferença de custo
 * numa pergunta curta é fração de centavo, e a de qualidade aparece na hora de
 * escolher a ferramenta certa. Economizar no roteador é economizar no lugar
 * errado.
 */
export const MODELO_DO_NIVEL: Record<Nivel, string> = {
  leve: "gemini-3.1-flash-lite",
  medio: "gemini-3.5-flash",
  pesado: "gemini-3.1-pro",
};

export function modeloPorId(id: string): ModeloDef | null {
  return MODELOS.find((modelo) => modelo.id === id) ?? null;
}

export function modeloDoNivel(nivel: Nivel): ModeloDef {
  const escolhido = modeloPorId(MODELO_DO_NIVEL[nivel]);
  // A tabela e o mapa vivem no mesmo arquivo e o teste cobra a coerência;
  // o fallback existe para nunca ficar sem modelo em produção.
  return escolhido ?? MODELOS[0];
}

export type CustoDaResposta = {
  /** US$ que a resposta custou ao nerp, sem margem. */
  custoDolar: number;
  /** R$ equivalente, sem margem. */
  custoReal: number;
  /** R$ cobrados, já com a margem. */
  precoReal: number;
  /** O mesmo, em ★. */
  estrelas: number;
};

export type BaseDeCobranca = {
  /** Quantos reais vale um dólar. */
  dolar: number;
  /** Quantos reais a organização paga por uma ★. */
  realPorEstrela: number;
  /** Sobre o custo. Padrão `MARGEM`; existe como parâmetro para o teste. */
  margem?: number;
};

/**
 * O que uma resposta custou e o que ela vale em ★.
 *
 * Sem arredondar para cima em bloco de mil, como era antes: com preço por
 * token de verdade, cobrar o bloco inteiro cobraria por token que não existiu.
 * O arredondamento final é o da moeda, e fica com quem grava.
 */
export function custoDaResposta(entrada: {
  modelo: ModeloDef;
  tokensIn: number;
  tokensOut: number;
  base: BaseDeCobranca;
}): CustoDaResposta {
  const entradaTokens = Math.max(0, entrada.tokensIn);
  const saidaTokens = Math.max(0, entrada.tokensOut);

  const custoDolar =
    (entradaTokens / 1000) * entrada.modelo.entradaPor1k +
    (saidaTokens / 1000) * entrada.modelo.saidaPor1k;

  const custoReal = custoDolar * Math.max(0, entrada.base.dolar);
  const precoReal = custoReal * (entrada.base.margem ?? MARGEM);
  const porEstrela = entrada.base.realPorEstrela;

  return {
    custoDolar,
    custoReal,
    precoReal,
    estrelas: porEstrela > 0 ? precoReal / porEstrela : 0,
  };
}
