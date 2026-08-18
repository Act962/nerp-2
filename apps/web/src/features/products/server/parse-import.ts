import * as XLSX from "xlsx";
import { ProductUnit } from "@/generated/prisma/enums";
import {
  PRODUCT_IMPORT_FIELDS,
  type ImportMapping,
} from "@/features/products/import-fields";
import type { CreateProductInput } from "./create-product";

/** Linha bruta da planilha: { nomeColuna: valor }. */
export type SheetRow = Record<string, unknown>;

/**
 * Lê um buffer de CSV ou XLSX e devolve as linhas como objetos indexados pelo
 * cabeçalho. O SheetJS (`XLSX.read`) detecta o formato automaticamente.
 */
export function parseSheet(buffer: Buffer): SheetRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "", raw: false });
}

/**
 * Converte um valor de célula em número, tolerando formatos brasileiros
 * ("1.234,56"), símbolos de moeda e espaços. Retorna `undefined` se vazio e
 * `NaN` se inválido (para o chamador reportar erro).
 */
export function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  let str = String(value).trim();
  if (str === "") return undefined;

  // Remove símbolos de moeda e espaços.
  str = str.replace(/[R$\s]/gi, "");

  const hasComma = str.includes(",");
  const hasDot = str.includes(".");
  if (hasComma && hasDot) {
    // "1.234,56" → ponto é separador de milhar, vírgula é decimal.
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // "1234,56" → vírgula é decimal.
    str = str.replace(",", ".");
  }

  return Number(str);
}

function parseUnit(value: unknown): ProductUnit | undefined {
  const str = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!str) return undefined;
  return (ProductUnit as Record<string, ProductUnit>)[str];
}

export interface MappedRow {
  /** Input pronto para `createProductForOrg`, sem o `categoryId`. */
  input: Omit<CreateProductInput, "categoryId">;
  /** Nome da categoria informado (resolvido pelo chamador para um id). */
  categoryName?: string;
  /** URL externa para thumbnail (baixada e enviada ao R2 pelo import-runner). */
  thumbnailUrl?: string;
  /** URLs externas para imagens adicionais (separadas por vírgula no CSV). */
  imageUrls?: string[];
  /** Mensagem de validação; se presente, a linha deve ser pulada. */
  error?: string;
}

const NUMBER_KEYS = new Set(
  PRODUCT_IMPORT_FIELDS.filter((f) => f.type === "number").map((f) => f.key),
);

/**
 * Converte texto puro em JSON no formato TipTap (ProseMirror doc).
 * Cada linha do texto vira um parágrafo separado.
 */
function plainTextToTiptap(text: string): string {
  const lines = text.split(/\r?\n/);
  const content = lines.map((line) => {
    if (!line.trim()) {
      return { type: "paragraph" };
    }
    return {
      type: "paragraph",
      content: [{ type: "text", text: line }],
    };
  });
  return JSON.stringify({ type: "doc", content });
}

/**
 * Aplica o mapeamento a uma linha da planilha e valida os campos obrigatórios e
 * numéricos. Não toca no banco — apenas transforma e valida.
 */
export function mapRow(row: SheetRow, mapping: ImportMapping): MappedRow {
  const get = (fieldKey: string): unknown => {
    const column = mapping[fieldKey];
    if (!column) return undefined;
    return row[column];
  };

  const name = String(get("name") ?? "").trim();
  if (!name) {
    return {
      input: { name: "", costPrice: 0, salePrice: 0 },
      error: "Nome é obrigatório",
    };
  }

  // Valida e converte os campos numéricos.
  const numbers: Record<string, number | undefined> = {};
  for (const key of NUMBER_KEYS) {
    const parsed = parseNumber(get(key));
    if (parsed !== undefined && Number.isNaN(parsed)) {
      const label =
        PRODUCT_IMPORT_FIELDS.find((f) => f.key === key)?.label ?? key;
      return {
        input: { name, costPrice: 0, salePrice: 0 },
        error: `Valor inválido em "${label}"`,
      };
    }
    numbers[key] = parsed;
  }

  if (numbers.costPrice === undefined) {
    return {
      input: { name, costPrice: 0, salePrice: 0 },
      error: "Preço de custo é obrigatório",
    };
  }
  if (numbers.salePrice === undefined) {
    return {
      input: { name, costPrice: 0, salePrice: 0 },
      error: "Preço de venda é obrigatório",
    };
  }

  const asString = (key: string) => {
    const v = get(key);
    const s = v === undefined || v === null ? "" : String(v).trim();
    return s === "" ? undefined : s;
  };

  const categoryName = asString("category");

  const rawDescription = asString("description");
  const description = rawDescription
    ? plainTextToTiptap(rawDescription)
    : undefined;

  const input: Omit<CreateProductInput, "categoryId"> = {
    name,
    sku: asString("sku"),
    barcode: asString("barcode"),
    description,
    unit: parseUnit(get("unit")),
    costPrice: numbers.costPrice,
    salePrice: numbers.salePrice,
    promotionalPrice: numbers.promotionalPrice,
    currentStock: numbers.currentStock,
    minStock: numbers.minStock,
    maxStock: numbers.maxStock,
    weight: numbers.weight,
    length: numbers.length,
    width: numbers.width,
    height: numbers.height,
  };

  const thumbnailUrl = asString("thumbnail");
  const rawImages = asString("images");
  const imageUrls = rawImages
    ? rawImages
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
    : undefined;

  return { input, categoryName, thumbnailUrl, imageUrls };
}
