/**
 * Os segmentos atendidos.
 *
 * A lista veio do material da marca, com duas mudanças pedidas: "Materiais de
 * construção" saiu e deu lugar a "Clínicas", e "Centro automotivo" entrou.
 *
 * As cores são as do material original — cada segmento tem a sua, e é ela que
 * separa um card do outro no painel. O verde-petróleo de Centro automotivo é o
 * único novo: não existia cor para ele.
 */

export type Segment = {
  id: string;
  name: string;
  /** Uma linha sobre a operação — abre o card no leitor de tela. */
  summary: string;
  /** A cor do card: borda, ícone e rótulo. */
  color: string;
  href?: string;
};

export const SEGMENTS: Segment[] = [
  {
    id: "supermercados",
    name: "Supermercados",
    summary: "Loja cheia, margem apertada e giro que não espera.",
    color: "#2f9bf5",
  },
  {
    id: "clinicas",
    name: "Clínicas",
    summary: "Agenda, prontuário do processo e retorno do paciente.",
    color: "#22a06b",
  },
  {
    id: "atacarejos",
    name: "Atacarejos",
    summary: "Atacado e varejo no mesmo CNPJ, com preço por canal.",
    color: "#8b3fe8",
  },
  {
    id: "franquias",
    name: "Franquias",
    summary: "Rede inteira no mesmo padrão, cada unidade no seu ritmo.",
    color: "#f2792b",
  },
  {
    id: "food",
    name: "Food Service",
    summary: "Salão, delivery e cozinha puxando do mesmo estoque.",
    color: "#ee3b32",
  },
  {
    id: "automotivo",
    name: "Centro automotivo",
    summary: "Orçamento, ordem de serviço e peça na bancada.",
    color: "#0f9b9b",
  },
];

/**
 * Onde cada segmento leva — o lugar para colar as URLs.
 *
 * Mesma regra do `TOOL_LINKS`: com URL o card vira link de verdade; sem URL
 * ele leva ao formulário de contato, que existe hoje. Assim as páginas de
 * segmento podem nascer uma a uma sem o menu apontar para o vazio.
 */
export const SEGMENT_LINKS: Record<string, string | undefined> = {
  // supermercados: "/segmentos/supermercados",
  // clinicas: "/segmentos/clinicas",
  // atacarejos: "/segmentos/atacarejos",
  // franquias: "/segmentos/franquias",
  // food: "/segmentos/food-service",
  // automotivo: "/segmentos/centro-automotivo",
};

export const SEGMENTS_WITH_LINKS: Segment[] = SEGMENTS.map((s) => ({
  ...s,
  href: SEGMENT_LINKS[s.id] ?? s.href,
}));
