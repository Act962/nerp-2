import type { OrgSegmentValue } from "@/lib/org-segment";
import type { SolucaoId } from "./solucoes";

/**
 * Os ramos do onboarding — os mesmos seis que o site institucional apresenta
 * (`@nerp/site-content` `segments.ts`), com o que cada um pré-marca no passo
 * de soluções e qual pacote de dados de exemplo recebe.
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
] as const;

export type NichoId = (typeof NICHO_IDS)[number];

export type PacoteDeExemplo = "mercearia";

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
    interesses: ["pdv", "estoque", "catalogo-promocional", "whatsapp", "astro"],
    pacote: "mercearia",
  },
  {
    id: "atacarejos",
    nome: "Atacarejos",
    resumo: "Atacado e varejo no mesmo CNPJ, com preço por canal.",
    segment: "VAREJO",
    interesses: ["pdv", "estoque", "catalogo-online", "ranking", "astro"],
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
    pacote: "mercearia",
  },
  {
    id: "clinicas",
    nome: "Clínicas",
    resumo: "Agenda, prontuário do processo e retorno do paciente.",
    segment: "OUTRO",
    interesses: ["whatsapp", "agenda", "financeiro", "astro"],
    pacote: "mercearia",
  },
  {
    id: "automotivo",
    nome: "Centro automotivo",
    resumo: "Orçamento, ordem de serviço e peça na bancada.",
    segment: "VAREJO",
    interesses: ["estoque", "pdv", "whatsapp", "financeiro", "astro"],
    pacote: "mercearia",
  },
];

export function nichoPorId(id: string | null | undefined): NichoDef | null {
  return NICHOS.find((nicho) => nicho.id === id) ?? null;
}
