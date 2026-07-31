import {
  parseSheet,
  type SheetRow,
} from "@/features/products/server/parse-import";
import type { ImportMapping } from "@/features/stores/import-fields";
import type { CreateStoreInput } from "./create-store-for-org";

// `parseSheet` é genérico (só lê o buffer CSV/XLSX); reexportamos para o runner.
export { parseSheet };
export type { SheetRow };

export interface MappedStoreRow {
  /** Input pronto para `createStoreForOrg`. */
  input: CreateStoreInput;
  /** Mensagem de validação; se presente, a linha deve ser pulada. */
  error?: string;
}

/**
 * Aplica o mapeamento a uma linha da planilha, validando o campo obrigatório
 * (nome). Não toca no banco — apenas transforma e valida.
 */
export function mapStoreRow(
  row: SheetRow,
  mapping: ImportMapping,
): MappedStoreRow {
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

  const input: CreateStoreInput = {
    name,
    code: asString("code"),
    managerName: asString("managerName"),
    address: asString("address"),
    city: asString("city"),
    state: asString("state"),
    notes: asString("notes"),
  };

  return { input };
}
