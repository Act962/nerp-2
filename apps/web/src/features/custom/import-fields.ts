/**
 * Campos de cliente disponíveis para importação via planilha.
 *
 * Módulo puro (sem dependências de cliente ou servidor) compartilhado entre o
 * wizard de importação (UI de mapeamento) e o processador Inngest (validação +
 * criação). Mantê-lo único garante que as duas pontas falem do mesmo conjunto.
 *
 * Espelha o input aceito por `customer.create` (`src/app/router/customer/create.ts`).
 * `email` é opcional; quando presente é a chave de deduplicação (único por
 * organização). Linhas sem email são sempre criadas (não há como deduplicar).
 */

export type ImportFieldType = "string" | "personType";

export interface ImportField {
  /** Chave usada no objeto de mapeamento e ao montar o input do cliente. */
  key: string;
  label: string;
  required: boolean;
  type: ImportFieldType;
  /** Dica exibida na UI de mapeamento. */
  hint?: string;
}

export const CUSTOMER_IMPORT_FIELDS: ImportField[] = [
  {
    key: "name",
    label: "Nome / Razão Social",
    required: true,
    type: "string",
  },
  {
    key: "email",
    label: "Email",
    required: false,
    type: "string",
    hint: "Se preenchido, é usado para evitar duplicados",
  },
  {
    key: "personType",
    label: "Tipo",
    required: false,
    type: "personType",
    hint: "FISICA ou JURIDICA — padrão Física",
  },
  {
    key: "document",
    label: "CPF/CNPJ",
    required: false,
    type: "string",
    hint: "CPF ou CNPJ",
  },
  { key: "phone", label: "Telefone", required: false, type: "string" },
  { key: "cep", label: "CEP", required: false, type: "string" },
  { key: "city", label: "Cidade", required: false, type: "string" },
  { key: "state", label: "Estado", required: false, type: "string" },
  { key: "address", label: "Endereço", required: false, type: "string" },
  { key: "notes", label: "Observação", required: false, type: "string" },
];

/** Mapeamento { chaveDoCampo: nomeDaColunaNoArquivo }. */
export type ImportMapping = Record<string, string>;
