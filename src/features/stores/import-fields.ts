/**
 * Campos de loja disponíveis para importação via planilha.
 *
 * Módulo puro (sem dependências de cliente ou servidor) compartilhado entre o
 * wizard de importação (UI de mapeamento) e o processador Inngest (validação +
 * criação). Mantê-lo único garante que as duas pontas falem do mesmo conjunto.
 *
 * Espelha o input aceito por `store.create` (`src/app/router/store/create.ts`).
 * `code` é opcional; quando presente é a chave de deduplicação (não há
 * constraint única no banco — a dedupe é feita em código, como em Supplier).
 * Linhas sem código são sempre criadas (não há como deduplicar).
 */

export type ImportFieldType = "string";

export interface ImportField {
  /** Chave usada no objeto de mapeamento e ao montar o input da loja. */
  key: string;
  label: string;
  required: boolean;
  type: ImportFieldType;
  /** Dica exibida na UI de mapeamento. */
  hint?: string;
}

export const STORE_IMPORT_FIELDS: ImportField[] = [
  { key: "name", label: "Nome", required: true, type: "string" },
  {
    key: "document",
    label: "CNPJ",
    required: false,
    type: "string",
    hint: "Do estabelecimento (cada filial o seu). É a dedupe mais confiável",
  },
  {
    key: "code",
    label: "Código",
    required: false,
    type: "string",
    hint: "Se preenchido, é usado para evitar duplicados",
  },
  { key: "managerName", label: "Gerente", required: false, type: "string" },
  { key: "address", label: "Endereço", required: false, type: "string" },
  {
    key: "number",
    label: "Número",
    required: false,
    type: "string",
    hint: "Se vier em coluna separada, é juntado ao endereço",
  },
  { key: "suburb", label: "Bairro", required: false, type: "string" },
  {
    key: "postcode",
    label: "CEP",
    required: false,
    type: "string",
    hint: "Ajuda a completar o endereço e a posicionar o ponto",
  },
  { key: "city", label: "Cidade", required: false, type: "string" },
  { key: "state", label: "Estado", required: false, type: "string" },
  { key: "notes", label: "Observação", required: false, type: "string" },
];

/** Mapeamento { chaveDoCampo: nomeDaColunaNoArquivo }. */
export type ImportMapping = Record<string, string>;
