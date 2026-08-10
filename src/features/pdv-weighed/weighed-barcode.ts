// Módulo puro (server + client): código de barras pesável da balança.
// Padrão EAN-13 com prefixo "2" (varejo BR — Toledo/Filizola): o código embute
// o código do produto + um valor (peso OU preço). O layout é configurável por
// org porque varia conforme a balança.

export type WeighedKind = "PRICE" | "WEIGHT";

export interface WeighedConfig {
  enabled: boolean;
  /** Prefixo que marca um código pesável (ex.: "2"). */
  prefix: string;
  /** O valor embutido é preço (R$) ou peso (kg). */
  kind: WeighedKind;
  /** Início (0-based) e tamanho do código do produto dentro do EAN. */
  codeStart: number;
  codeLength: number;
  /** Início (0-based) e tamanho do valor (peso/preço). */
  valueStart: number;
  valueLength: number;
  /** Casas decimais implícitas do valor (ex.: 2 = centavos; 3 = gramas→kg). */
  valueDecimals: number;
}

// Layout mais comum no varejo BR: 2 + 6 dígitos de código + 5 de valor (preço
// com 2 casas) + dígito verificador. Desligado por padrão — o admin ativa e
// ajusta conforme a balança da loja.
export const DEFAULT_WEIGHED_CONFIG: WeighedConfig = {
  enabled: false,
  prefix: "2",
  kind: "PRICE",
  codeStart: 1,
  codeLength: 6,
  valueStart: 7,
  valueLength: 5,
  valueDecimals: 2,
};

export interface WeighedResult {
  /** Código do produto embutido — casar com `sku`/`barcode` do cadastro. */
  itemCode: string;
  kind: WeighedKind;
  /** Preenchido quando kind = PRICE. */
  price: number | null;
  /** Preenchido quando kind = WEIGHT. */
  weightKg: number | null;
}

export function resolveWeighedConfig(
  raw?: Partial<Record<string, unknown>> | null,
): WeighedConfig {
  const base = DEFAULT_WEIGHED_CONFIG;
  const source =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (key: string, fallback: number) =>
    typeof source[key] === "number" ? (source[key] as number) : fallback;
  const str = (key: string, fallback: string) =>
    typeof source[key] === "string" ? (source[key] as string) : fallback;
  const bool = (key: string, fallback: boolean) =>
    typeof source[key] === "boolean" ? (source[key] as boolean) : fallback;
  return {
    enabled: bool("enabled", base.enabled),
    prefix: str("prefix", base.prefix),
    kind: source.kind === "WEIGHT" ? "WEIGHT" : "PRICE",
    codeStart: num("codeStart", base.codeStart),
    codeLength: num("codeLength", base.codeLength),
    valueStart: num("valueStart", base.valueStart),
    valueLength: num("valueLength", base.valueLength),
    valueDecimals: num("valueDecimals", base.valueDecimals),
  };
}

// Retorna o código do produto + valor, ou null quando não é um código pesável.
export function parseWeighedBarcode(
  code: string,
  config: WeighedConfig,
): WeighedResult | null {
  if (!config.enabled) return null;
  const digits = code.trim();
  if (!/^\d+$/.test(digits)) return null;
  if (config.prefix && !digits.startsWith(config.prefix)) return null;

  const codeEnd = config.codeStart + config.codeLength;
  const valueEnd = config.valueStart + config.valueLength;
  if (digits.length < Math.max(codeEnd, valueEnd)) return null;

  const itemCode = digits.slice(config.codeStart, codeEnd);
  const rawValue = digits.slice(config.valueStart, valueEnd);
  if (!/^\d+$/.test(itemCode) || !/^\d+$/.test(rawValue)) return null;

  const value = Number(rawValue) / 10 ** config.valueDecimals;
  return {
    itemCode,
    kind: config.kind,
    price: config.kind === "PRICE" ? value : null,
    weightKg: config.kind === "WEIGHT" ? value : null,
  };
}
