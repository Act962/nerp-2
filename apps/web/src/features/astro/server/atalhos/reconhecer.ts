/**
 * Perguntas que não precisam de IA.
 *
 * "Quantos produtos eu tenho" tem UMA resposta, que sai de uma contagem. Hoje
 * ela custa ~42 mil caracteres de contexto para o modelo decidir chamar a
 * ferramenta e depois escrever a frase. A contagem é a mesma; a frase, escrita
 * em código, é melhor — nunca erra o número.
 *
 * O reconhecimento é o ponto delicado, e por isso é **desconfiado por
 * construção**. Um atalho que dispara errado responde com total confiança a
 * pergunta que ninguém fez, e isso é pior que pagar os tokens. Então:
 *
 *  - só casa a frase INTEIRA, não um trecho dela;
 *  - recusa qualquer coisa com "e", "também", "além" ligando dois pedidos;
 *  - recusa pergunta de sequência ("e ontem?"), que só significa algo em
 *    relação ao turno anterior;
 *  - na dúvida, devolve `null` e a conversa segue pelo modelo.
 *
 * Módulo puro: sem banco, sem rede. O que ele decide é qual pergunta é, não
 * qual é a resposta.
 */

import type { Periodo } from "../periodo";

export const ATALHOS = [
  "contarProdutos",
  "contarClientes",
  "contarFornecedores",
  "contarLojas",
  "saldoDeStars",
  "resumoDeVendas",
  "ticketMedio",
  "produtoMaisVendido",
  "contarCatalogos",
  "contarEstoqueBaixo",
] as const;

export type Atalho = (typeof ATALHOS)[number];

export type PerguntaReconhecida = {
  atalho: Atalho;
  /** Só nas que falam de tempo. */
  periodo?: Periodo;
};

/** Sem acento, minúscula, sem pontuação de ponta, espaços colapsados. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O que desqualifica a frase antes de olhar o conteúdo.
 *
 * Duas perguntas numa só ("quanto vendi e o que mais saiu") o atalho não sabe
 * responder, e responder metade seria pior que não responder. Frase começada
 * por "e" é continuação do turno anterior.
 */
const LIGACAO =
  /\b(e|tambem|alem disso|mais|ou)\b.*\b(quanto|quantos|quantas|qual|quais)\b/;
const CONTINUACAO = /^(e|ent[ao]+|ai|mas)\b/;
const REFERENCIA = /\b(esse|essa|isso|ele|ela|aquele|aquela|dele|dela|mesmo)\b/;

const PERIODOS: { padrao: RegExp; periodo: Periodo }[] = [
  { padrao: /\bhoje\b/, periodo: "hoje" },
  { padrao: /\bontem\b/, periodo: "ontem" },
  { padrao: /\b(7|sete) dias\b|\bsemana\b/, periodo: "7d" },
  { padrao: /\b(30|trinta) dias\b/, periodo: "30d" },
  { padrao: /\bmes passado\b|\bmes anterior\b/, periodo: "mes_anterior" },
  { padrao: /\b(este|esse|no) mes\b|\bmes\b/, periodo: "mes" },
];

function lerPeriodo(texto: string): Periodo | null {
  for (const { padrao, periodo } of PERIODOS) {
    if (padrao.test(texto)) return periodo;
  }
  return null;
}

/** Cada atalho e as frases inteiras que o disparam. */
const REGRAS: { atalho: Atalho; padroes: RegExp[]; comPeriodo?: boolean }[] = [
  {
    atalho: "contarProdutos",
    padroes: [
      /^quantos produtos( eu| a gente| voce| nos)?( tenho| temos| tem| ha| existem| cadastrados?| tem cadastrados?)?$/,
      /^(qual|quantos) (e )?(o )?(numero|total) de produtos$/,
    ],
  },
  {
    atalho: "contarClientes",
    padroes: [
      /^quantos clientes( eu| a gente| voce| nos)?( tenho| temos| tem| ha| existem| cadastrados?)?$/,
      /^(qual|quantos) (e )?(o )?(numero|total) de clientes$/,
    ],
  },
  {
    atalho: "contarFornecedores",
    padroes: [
      /^quantos (fornecedores|industrias)( eu| a gente| voce| nos)?( tenho| temos| tem| ha| existem| cadastrados?)?$/,
    ],
  },
  {
    atalho: "contarLojas",
    padroes: [
      /^quantas lojas( eu| a gente| voce| nos)?( tenho| temos| tem| ha| existem| cadastradas?)?$/,
    ],
  },
  {
    atalho: "saldoDeStars",
    padroes: [
      /^quantas stars( eu| a gente| nos)?( tenho| temos| tem| restam| sobraram| sobram)?$/,
      /^qual (e )?(o )?(meu |nosso )?saldo( de stars| de estrelas)?$/,
      /^quanto( de)? saldo( eu| a gente| nos)?( tenho| temos| tem)?$/,
    ],
  },
  {
    atalho: "resumoDeVendas",
    comPeriodo: true,
    padroes: [
      /^quanto (eu |a gente |nos )?vend[ei](mos|i)?( ontem| hoje)?.*$/,
      /^qual (foi )?(o )?(meu |nosso )?(total|faturamento) (de |das |em )?vendas.*$/,
      /^quanto (foi|deu) (o )?(faturamento|total)( de vendas)?.*$/,
    ],
  },
  {
    atalho: "ticketMedio",
    comPeriodo: true,
    padroes: [
      /^qual (e |foi )?(o )?(meu |nosso )?ticket (medio|media).*$/,
      /^ticket medio.*$/,
    ],
  },
  {
    atalho: "produtoMaisVendido",
    comPeriodo: true,
    padroes: [
      /^qual (produto|o produto) (mais vendeu|que mais vendeu|mais saiu|que mais saiu).*$/,
      /^qual (e |foi )?(o )?produto mais vendido.*$/,
      /^o que mais (vendeu|saiu).*$/,
    ],
  },
  {
    atalho: "contarCatalogos",
    padroes: [
      /^quantos catalogos( promocionais)?( eu| a gente| nos)?( tenho| temos| tem| criei| criamos| ja criei| ja criamos| foram criados)?$/,
    ],
  },
  {
    atalho: "contarEstoqueBaixo",
    padroes: [
      /^quantos produtos (estao |tao )?(com )?(o )?estoque baixo$/,
      /^quantos produtos (estao |tao )?abaixo do (estoque )?minimo$/,
    ],
  },
];

export function reconhecerPergunta(
  falaCrua: string,
): PerguntaReconhecida | null {
  const texto = normalizar(falaCrua);
  if (!texto || texto.length > 120) return null;
  if (CONTINUACAO.test(texto)) return null;
  if (REFERENCIA.test(texto)) return null;
  if (LIGACAO.test(texto)) return null;

  for (const regra of REGRAS) {
    if (!regra.padroes.some((padrao) => padrao.test(texto))) continue;

    if (!regra.comPeriodo) return { atalho: regra.atalho };

    // Pergunta sobre tempo SEM dizer o tempo é ambígua: "quanto vendi" pode
    // ser hoje, o mês, o ano. Deixa para o modelo, que pergunta de volta.
    const periodo = lerPeriodo(texto);
    if (!periodo) return null;
    return { atalho: regra.atalho, periodo };
  }

  return null;
}
