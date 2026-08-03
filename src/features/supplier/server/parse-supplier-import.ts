import { PersonType } from "@/generated/prisma/enums";
import {
  parseSheet,
  type SheetRow,
} from "@/features/products/server/parse-import";
import { formatCPForCNPJ } from "@/utils/format-cnpj";
import { phoneMask } from "@/utils/format-phone";
import { cepMask } from "@/utils/format-cep";
import type { ImportMapping } from "@/features/supplier/import-fields";
import type { CreateSupplierInput } from "./create-supplier-for-org";

// `parseSheet` é genérico (só lê o buffer CSV/XLSX); reexportamos para o runner.
export { parseSheet };
export type { SheetRow };

export interface MappedSupplierRow {
  /** Input pronto para `createSupplierForOrg`. */
  input: CreateSupplierInput;
  /** Mensagem de validação; se presente, a linha deve ser pulada. */
  error?: string;
}

/**
 * Normaliza o valor da coluna "Tipo" para o enum `PersonType`.
 * Aceita variações comuns (FISICA/JURIDICA, física/jurídica, PF/PJ, CPF/CNPJ);
 * vazio ou inválido cai no padrão do sistema (`JURIDICA`).
 */
function normalizePersonType(value: unknown): PersonType {
  const str = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!str) return PersonType.JURIDICA;

  const fisica = [
    "fisica",
    "física",
    "pf",
    "pessoa fisica",
    "pessoa física",
    "cpf",
  ];
  const juridica = [
    "juridica",
    "jurídica",
    "pj",
    "pessoa juridica",
    "pessoa jurídica",
    "cnpj",
  ];

  if (fisica.includes(str)) return PersonType.FISICA;
  if (juridica.includes(str)) return PersonType.JURIDICA;
  return PersonType.JURIDICA;
}

/**
 * Aplica o mapeamento a uma linha da planilha, validando o campo obrigatório
 * (nome) e normalizando documento/telefone/CEP/tipo. Não toca no banco — apenas
 * transforma e valida.
 */
export function mapSupplierRow(
  row: SheetRow,
  mapping: ImportMapping,
): MappedSupplierRow {
  const get = (fieldKey: string): unknown => {
    const column = mapping[fieldKey];
    if (!column) return undefined;
    return row[column];
  };

  const asString = (key: string) => {
    const v = get(key);
    const s = v === undefined || v === null ? "" : String(v).trim();
    return s === "" ? undefined : s;
  };

  const name = String(get("name") ?? "").trim();
  if (!name) {
    return { input: { name: "" }, error: "Nome é obrigatório" };
  }

  const rawDocument = asString("document");
  const rawPhone = asString("phone");
  const rawCep = asString("cep");

  const input: CreateSupplierInput = {
    name,
    tradeName: asString("tradeName"),
    personType: normalizePersonType(get("personType")),
    document: rawDocument ? formatCPForCNPJ(rawDocument) : undefined,
    email: asString("email"),
    phone: rawPhone ? phoneMask(rawPhone) : undefined,
    contactPerson: asString("contactPerson"),
    cep: rawCep ? cepMask(rawCep) : undefined,
    city: asString("city"),
    state: asString("state"),
    address: asString("address"),
    notes: asString("notes"),
  };

  return { input };
}
