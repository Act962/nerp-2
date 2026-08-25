/**
 * Campos de fornecedor disponíveis para importação via planilha.
 *
 * Módulo puro (sem dependências de cliente ou servidor) compartilhado entre o
 * wizard de importação (UI de mapeamento) e o processador Inngest (validação +
 * criação). Mantê-lo único garante que as duas pontas falem do mesmo conjunto.
 *
 * Espelha o input aceito por `supplier.create` (`src/app/router/supplier/create.ts`).
 */

export type ImportFieldType = "string" | "personType";

export interface ImportField {
  /** Chave usada no objeto de mapeamento e ao montar o input do fornecedor. */
  key: string;
  label: string;
  required: boolean;
  type: ImportFieldType;
  /** Dica exibida na UI de mapeamento. */
  hint?: string;
}

export const SUPPLIER_IMPORT_FIELDS: ImportField[] = [
  {
    key: "name",
    label: "Razão Social / Nome",
    required: true,
    type: "string",
  },
  { key: "tradeName", label: "Nome Fantasia", required: false, type: "string" },
  {
    key: "personType",
    label: "Tipo",
    required: false,
    type: "personType",
    hint: "FISICA ou JURIDICA — padrão Jurídica",
  },
  {
    key: "document",
    label: "CPF/CNPJ",
    required: false,
    type: "string",
    hint: "CPF ou CNPJ",
  },
  { key: "email", label: "Email", required: false, type: "string" },
  { key: "phone", label: "Telefone", required: false, type: "string" },
  {
    key: "contactPerson",
    label: "Pessoa de Contato",
    required: false,
    type: "string",
  },
  { key: "cep", label: "CEP", required: false, type: "string" },
  { key: "city", label: "Cidade", required: false, type: "string" },
  { key: "state", label: "Estado", required: false, type: "string" },
  { key: "address", label: "Endereço", required: false, type: "string" },
  { key: "notes", label: "Observação", required: false, type: "string" },
];

/** Mapeamento { chaveDoCampo: nomeDaColunaNoArquivo }. */
export type ImportMapping = Record<string, string>;
