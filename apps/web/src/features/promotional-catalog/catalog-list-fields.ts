// Campos que a aba "Lista" reconhece numa planilha. O usuário mapeia cada campo
// a uma coluna do arquivo (padrão de `supplier/import-fields.ts`).

export interface ListField {
  key:
    | "client"
    | "productName"
    | "normalPrice"
    | "offerPrice"
    | "department"
    | "startDate"
    | "endDate";
  label: string;
  required: boolean;
  hint?: string;
  // Sinônimos de cabeçalho para o auto-mapeamento.
  aliases?: string[];
}

export const LIST_FIELDS: ListField[] = [
  {
    key: "client",
    label: "Cliente",
    required: true,
    hint: "Divide o catálogo — uma página por cliente.",
    aliases: ["cliente", "loja", "clienteloja", "rede", "unidade"],
  },
  {
    key: "productName",
    label: "Nome do produto",
    required: true,
    aliases: ["produto", "nomedoproduto", "descricao", "descrição", "item"],
  },
  {
    key: "normalPrice",
    label: "Preço normal",
    required: false,
    hint: 'O "De" (preço cheio).',
    aliases: [
      "preconormal",
      "preçonormal",
      "de",
      "precodemercado",
      "precocheio",
    ],
  },
  {
    key: "offerPrice",
    label: "Preço da oferta",
    required: true,
    hint: 'O "Por" (preço promocional).',
    aliases: [
      "precodaoferta",
      "preçodaoferta",
      "oferta",
      "por",
      "precopromocional",
      "promocao",
    ],
  },
  {
    key: "department",
    label: "Departamento",
    required: false,
    aliases: [
      "departamento",
      "categoria",
      "setor",
      "secao",
      "seção",
      "familia",
      "família",
      "linha",
      "grupo",
    ],
  },
  {
    key: "startDate",
    label: "Data início",
    required: false,
    aliases: [
      "datainicio",
      "datainício",
      "inicio",
      "início",
      "de",
      "validadeinicio",
    ],
  },
  {
    key: "endDate",
    label: "Data fim",
    required: false,
    aliases: ["datafim", "fim", "ate", "até", "validadefim", "vencimento"],
  },
];

export type ListMapping = Partial<Record<ListField["key"], string>>;

// Normaliza um cabeçalho para comparação (minúsculas, sem acento/pontuação).
export function normHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Pré-seleciona colunas cujo nome bate com a chave/label/aliases do campo.
export function autoMapColumns(columns: string[]): ListMapping {
  const mapping: ListMapping = {};
  const normed = columns.map((c) => ({ col: c, n: normHeader(c) }));
  for (const field of LIST_FIELDS) {
    const candidates = [field.key, field.label, ...(field.aliases ?? [])].map(
      normHeader,
    );
    const hit = normed.find((c) => candidates.includes(c.n));
    if (hit) mapping[field.key] = hit.col;
  }
  return mapping;
}
