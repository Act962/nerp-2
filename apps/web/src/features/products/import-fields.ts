/**
 * Campos de produto disponíveis para importação via planilha.
 *
 * Módulo puro (sem dependências de cliente ou servidor) compartilhado entre o
 * wizard de importação (UI de mapeamento) e o processador Inngest (validação +
 * criação). Mantê-lo único garante que as duas pontas falem do mesmo conjunto.
 */

export type ImportFieldType = "string" | "number" | "unit" | "category";

export interface ImportField {
  /** Chave usada no objeto de mapeamento e ao montar o input do produto. */
  key: string;
  label: string;
  required: boolean;
  type: ImportFieldType;
  /** Dica exibida na UI de mapeamento. */
  hint?: string;
}

export const PRODUCT_IMPORT_FIELDS: ImportField[] = [
  { key: "name", label: "Nome", required: true, type: "string" },
  { key: "sku", label: "SKU", required: false, type: "string" },
  {
    key: "barcode",
    label: "Código de barras",
    required: false,
    type: "string",
  },
  { key: "description", label: "Descrição", required: false, type: "string" },
  {
    key: "category",
    label: "Categoria",
    required: false,
    type: "category",
    hint: "Nome da categoria — criada automaticamente se não existir",
  },
  {
    key: "unit",
    label: "Unidade",
    required: false,
    type: "unit",
    hint: "UN, KG, G, L, ML, M, M2, M3, CX, PC, PAR, DZ",
  },
  { key: "costPrice", label: "Preço de custo", required: true, type: "number" },
  { key: "salePrice", label: "Preço de venda", required: true, type: "number" },
  {
    key: "promotionalPrice",
    label: "Preço promocional",
    required: false,
    type: "number",
  },
  {
    key: "currentStock",
    label: "Estoque atual",
    required: false,
    type: "number",
  },
  { key: "minStock", label: "Estoque mínimo", required: false, type: "number" },
  { key: "maxStock", label: "Estoque máximo", required: false, type: "number" },
  { key: "weight", label: "Peso", required: false, type: "number" },
  { key: "length", label: "Comprimento", required: false, type: "number" },
  { key: "width", label: "Largura", required: false, type: "number" },
  { key: "height", label: "Altura", required: false, type: "number" },
  {
    key: "thumbnail",
    label: "URL da thumbnail",
    required: false,
    type: "string",
    hint: "URL externa da imagem principal do produto",
  },
  {
    key: "images",
    label: "URLs de imagens adicionais",
    required: false,
    type: "string",
    hint: "URLs separadas por vírgula",
  },
];

/** Mapeamento { chaveDoCampo: nomeDaColunaNoArquivo }. */
export type ImportMapping = Record<string, string>;
