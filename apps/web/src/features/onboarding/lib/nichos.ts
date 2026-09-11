import type { OrgSegmentValue } from "@/lib/org-segment";
import type { SolucaoId } from "./solucoes";

/**
 * Os ramos do onboarding — os mesmos seis que o site institucional apresenta
 * (`@nerp/site-content` `segments.ts`), mais "outro", com o que cada um
 * pré-marca no passo de soluções e qual pacote de dados de exemplo recebe.
 *
 * "Outro" não é enfeite. Sem ele, quem não é nenhum dos seis só tinha "Pular"
 * — e pular é dizer "não quero responder", não "sou de um ramo que não está
 * aí". A segunda é uma resposta, e jogá-la fora custa duas coisas: a pessoa
 * termina sem nenhuma solução marcada (e o guia do dashboard nasce vazio,
 * justamente para quem mais precisaria dele), e a gente perde o único sinal
 * que diria quais pacotes de exemplo vale construir depois.
 *
 * Estático de propósito: nenhum token de IA entra na porta do sistema.
 */

export const NICHO_IDS = [
  "supermercados",
  "clinicas",
  "atacarejos",
  "franquias",
  "food",
  "automotivo",
  "outro",
] as const;

export type NichoId = (typeof NICHO_IDS)[number];

export type PacoteDeExemplo =
  | "mercearia"
  | "food"
  | "clinica"
  | "automotivo"
  | "generico";

/**
 * O que se pré-marca quando não se sabe o ramo.
 *
 * Produto, estoque, catálogo, WhatsApp e o Astro servem a quase qualquer
 * negócio que vende alguma coisa. O ponto não é acertar o ramo: é o guia do
 * dashboard nunca abrir vazio, porque guia vazio é a tela dizendo "vire-se".
 */
export const INTERESSES_PADRAO: SolucaoId[] = [
  "pdv",
  "estoque",
  "catalogo-promocional",
  "whatsapp",
  "astro",
];

export interface NichoDef {
  id: NichoId;
  nome: string;
  resumo: string;
  /** Segmento sugerido para `Organization.segment`. */
  segment: OrgSegmentValue;
  /** Soluções pré-marcadas no passo 2. */
  interesses: SolucaoId[];
  /** Qual pacote de mocks entra na org. */
  pacote: PacoteDeExemplo;
}

export const NICHOS: NichoDef[] = [
  {
    id: "supermercados",
    nome: "Supermercados",
    resumo: "Loja cheia, margem apertada e giro que não espera.",
    segment: "VAREJO",
    interesses: [
      "pdv",
      "estoque",
      "catalogo-promocional",
      "qr-preco",
      "whatsapp",
      "astro",
    ],
    pacote: "mercearia",
  },
  {
    id: "atacarejos",
    nome: "Atacarejos",
    resumo: "Atacado e varejo no mesmo CNPJ, com preço por canal.",
    segment: "VAREJO",
    interesses: [
      "pdv",
      "estoque",
      "catalogo-online",
      "qr-preco",
      "ranking",
      "astro",
    ],
    pacote: "mercearia",
  },
  {
    id: "franquias",
    nome: "Franquias",
    resumo: "Rede inteira no mesmo padrão, cada unidade no seu ritmo.",
    segment: "VAREJO",
    interesses: ["trade", "ranking", "catalogo-promocional", "astro"],
    pacote: "mercearia",
  },
  {
    id: "food",
    nome: "Food Service",
    resumo: "Salão, delivery e cozinha puxando do mesmo estoque.",
    segment: "VAREJO",
    interesses: ["pdv", "pedidos", "estoque", "whatsapp", "astro"],
    pacote: "food",
  },
  {
    id: "clinicas",
    nome: "Clínicas",
    resumo: "Agenda, prontuário do processo e retorno do paciente.",
    segment: "OUTRO",
    interesses: ["whatsapp", "agenda", "financeiro", "astro"],
    pacote: "clinica",
  },
  {
    id: "automotivo",
    nome: "Centro automotivo",
    resumo: "Orçamento, ordem de serviço e peça na bancada.",
    segment: "VAREJO",
    interesses: ["estoque", "pdv", "whatsapp", "financeiro", "astro"],
    pacote: "automotivo",
  },
  {
    id: "outro",
    nome: "Outro ramo",
    resumo: "Conte em duas palavras o que a sua empresa faz.",
    // Varejo é o segmento que menos esconde módulo: começar escondendo o que
    // a pessoa talvez queira ver é pior que mostrar algo que ela não usa.
    segment: "VAREJO",
    interesses: INTERESSES_PADRAO,
    pacote: "generico",
  },
];

/**
 * Soluções que NENHUM ramo pré-marca, de propósito.
 *
 * Os seis ramos do onboarding são de quem vende ao consumidor — supermercado,
 * clínica, oficina. Estas três são de quem trabalha o ponto de venda dos
 * OUTROS: indústria, distribuidor e agência. Sugeri-las a um supermercado
 * seria marcar o que ele não vai usar, e o pré-marcado vira o guia de
 * primeiros passos — guia com passo errado é pior que guia curto.
 *
 * A lista existe para o teste poder cobrar uma decisão a cada solução nova:
 * ou algum ramo a sugere, ou ela entra aqui com o motivo. O que não pode é
 * uma solução nascer invisível sem ninguém ter reparado.
 */
export const SEM_SUGESTAO_POR_RAMO: SolucaoId[] = [
  "tradegram",
  "planograma",
  "book",
];

/** O ramo escrito à mão cabe em `Organization.niche`, que é texto livre. */
export const MAX_RAMO_LIVRE = 60;

/**
 * Limpa o que a pessoa digitou no "Outro".
 *
 * Vai para o banco e volta na tela, então nada de caractere de controle nem
 * texto sem fim. Vazio devolve `null`: "Outro" sem dizer o quê é o mesmo que
 * não ter dito.
 */
export function limparRamoLivre(
  texto: string | null | undefined,
): string | null {
  if (!texto) return null;
  const limpo = texto
    // biome-ignore lint/suspicious/noControlCharactersInRegex: é justamente o que se está tirando
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_RAMO_LIVRE);
  return limpo.length > 0 ? limpo : null;
}

export function nichoPorId(id: string | null | undefined): NichoDef | null {
  return NICHOS.find((nicho) => nicho.id === id) ?? null;
}
