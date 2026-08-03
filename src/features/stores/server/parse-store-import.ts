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

  // Número em coluna separada é o formato comum das listas de clientes, e o
  // geocode estruturado acerta muito mais com "Rua X, 123" do que com "Rua X".
  const street = asString("address");
  const number = asString("number");
  const address =
    street && number ? `${street}, ${number}` : (street ?? undefined);

  const input: CreateStoreInput = {
    name,
    code: asString("code"),
    managerName: asString("managerName"),
    address,
    city: asString("city"),
    state: asString("state"),
    notes: asString("notes"),
    document: asString("document"),
    suburb: asString("suburb"),
    postcode: asString("postcode"),
  };

  return { input };
}
