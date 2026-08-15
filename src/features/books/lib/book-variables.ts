// Variáveis do Book — tokens `{{chave}}` que o usuário insere num elemento de
// texto do editor e que são resolvidos por item de PDV na geração do PDF.
// Compartilhado entre o editor (client) e generate-book.tsx (server).

export interface BookVariableDefinition {
  key: string;
  label: string;
  // Escopo do valor: "item" muda a cada página de PDV; "book" é constante no
  // documento inteiro (serve também em capa/página final).
  scope: "item" | "book";
  sample: string;
}

export const BOOK_VARIABLES: BookVariableDefinition[] = [
  {
    key: "loja",
    label: "Loja / PDV",
    scope: "item",
    sample: "Supermercado Modelo",
  },
  { key: "gerente", label: "Gerente", scope: "item", sample: "Carlos Souza" },
  {
    key: "coordenador",
    label: "Coordenador(a)",
    scope: "item",
    sample: "Ana Lima",
  },
  {
    key: "consultor",
    label: "Consultor(a)",
    scope: "item",
    sample: "Marcos Dias",
  },
  {
    key: "empresaPdv",
    label: "Empresa do PDV",
    scope: "item",
    sample: "Distribuidora XYZ",
  },
  { key: "midia", label: "Mídia", scope: "item", sample: "Ponta de gôndola" },
  { key: "secao", label: "Seção", scope: "item", sample: "Bebidas" },
  { key: "codigo", label: "Código", scope: "item", sample: "PDV-01234" },
  {
    key: "cidade",
    label: "Cidade da loja/PDV",
    scope: "item",
    sample: "Teresina",
  },
  { key: "uf", label: "UF da loja/PDV", scope: "item", sample: "PI" },
  {
    key: "numeroFoto",
    label: "Número da foto (FOTO N)",
    scope: "item",
    sample: "11",
  },
  { key: "promotor", label: "Promotor da foto", scope: "item", sample: "João" },
  {
    key: "valorAcao",
    label: "Valor da ação",
    scope: "item",
    sample: "R$ 1.250,00",
  },
  {
    key: "numeroPagina",
    label: "Número da página",
    scope: "item",
    sample: "3 / 12",
  },
  {
    key: "nomeBook",
    label: "Nome do book",
    scope: "book",
    sample: "Book Maio",
  },
  { key: "periodo", label: "Período", scope: "book", sample: "Maio / 2026" },
  {
    key: "industria",
    label: "Indústria / Fornecedor",
    scope: "book",
    sample: "Indústria ABC",
  },
];

export type BookVariableValues = Partial<Record<string, string | null>>;

export function buildVariableToken(key: string): string {
  return `{{${key}}}`;
}

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

// Token sem valor vira string vazia em vez de ficar `{{gerente}}` cru no PDF —
// campo não preenchido no PDV é comum e não deve virar sujeira no material
// que vai pro cliente.
export function resolveVariables(
  text: string,
  values: BookVariableValues,
): string {
  return text.replace(TOKEN_PATTERN, (_match, key: string) => {
    const value = values[key];
    return value == null ? "" : String(value);
  });
}

export function extractVariableKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const match of text.matchAll(TOKEN_PATTERN)) keys.add(match[1]);
  return [...keys];
}

// Valores de exemplo pro preview do editor — sem isso o usuário monta o
// template olhando pra tokens crus e não consegue julgar tamanho de fonte.
export function buildSampleValues(): BookVariableValues {
  return Object.fromEntries(
    BOOK_VARIABLES.map((variable) => [variable.key, variable.sample]),
  );
}
