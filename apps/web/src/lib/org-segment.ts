import type { PagePermissionKey } from "@/lib/permissions";

export const ORG_SEGMENTS = [
  "VAREJO",
  "INDUSTRIA",
  "DISTRIBUIDOR",
  "AGENCIA",
  "OUTRO",
] as const;

export type OrgSegmentValue = (typeof ORG_SEGMENTS)[number];

export const SEGMENT_LABELS: Record<OrgSegmentValue, string> = {
  VAREJO: "Varejo / PDV",
  INDUSTRIA: "Indústria",
  DISTRIBUIDOR: "Distribuidor / Representante",
  AGENCIA: "Agência",
  OUTRO: "Outro",
};

export const SEGMENT_HINTS: Record<OrgSegmentValue, string> = {
  VAREJO: "Supermercado, farmácia ou rede que opera as próprias lojas",
  INDUSTRIA: "Fabrica e quer presença nos pontos de venda",
  DISTRIBUIDOR: "Leva produtos da indústria até os pontos de venda",
  AGENCIA: "Presta serviço de trade para indústrias e distribuidores",
  OUTRO: "Nenhum dos anteriores",
};

/**
 * Módulos que nascem DESLIGADOS por segmento.
 *
 * Semente, não permissão. Já existem quatro camadas decidindo se um item de
 * menu aparece — papel, permissões, módulos da org e módulos do usuário. Uma
 * quinta tornaria "por que não vejo X?" impossível de responder, então isto só
 * preenche `Organization.disabledModules` na criação, e o dono muda em dois
 * cliques em Configurações → Módulos.
 *
 * Uma indústria não vende no balcão: pedidos, vendas, catálogo e QR Preço só
 * ocupariam espaço. O varejo continua vendo tudo, exatamente como hoje.
 */
export const SEGMENT_DEFAULT_DISABLED: Record<
  OrgSegmentValue,
  PagePermissionKey[]
> = {
  VAREJO: [],
  INDUSTRIA: [
    "pedidos",
    "vendas",
    "catalogo",
    "catalogo-promocional",
    "qr-preco",
    "estoque",
  ],
  DISTRIBUIDOR: ["pedidos", "vendas", "catalogo", "catalogo-promocional"],
  AGENCIA: [
    "pedidos",
    "vendas",
    "catalogo",
    "catalogo-promocional",
    "estoque",
    "produtos",
  ],
  OUTRO: [],
};

/**
 * Ponte com a taxonomia do diretório, para quando as duas precisam conversar.
 *
 * Usada só como SINAL FRACO na reivindicação — "organização de varejo pedindo
 * uma ficha de indústria" merece um olhar humano, nunca um bloqueio.
 */
export function segmentToCompanyType(
  segment: OrgSegmentValue,
): "SUPERMERCADO" | "INDUSTRIA" | "DISTRIBUIDOR" | null {
  if (segment === "VAREJO") return "SUPERMERCADO";
  if (segment === "INDUSTRIA") return "INDUSTRIA";
  if (segment === "DISTRIBUIDOR") return "DISTRIBUIDOR";
  return null;
}
