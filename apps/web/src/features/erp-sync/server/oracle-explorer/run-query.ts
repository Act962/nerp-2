import "server-only";
import { createHash } from "node:crypto";
import type { WidgetValue } from "@/app/router/dashboard-widgets/_types";
import type { OracleQueryConfig } from "@/features/dashboard-widgets/lib/oracle-query-config";
import { loadOracleConfig } from "../connectors";
import { withOracleReadOnly } from "../oracle-client";
import { buildOracleQuery } from "./build-query";
import { loadSchemaDictionary } from "./dictionary";
import { preflightOracleQuery } from "./preflight";

// Timeout curto de propósito: é consulta interativa contra o ERP de produção
// do cliente, não o sync noturno (que usa os 180s do default). O callTimeout do
// node-oracledb envia cancelamento ao servidor, então o Oracle também para.
const QUERY_TIMEOUT_MS = 20_000;

/** Teto de linhas trazidas do cursor — guarda de payload, não de varredura. */
const MAX_ROWS = 500;

export type OracleDisplayType = "STAT" | "CHART" | "LIST" | "TABLE";

export interface RunQueryResult {
  value: WidgetValue;
  rowCount: number;
  elapsedMs: number;
}

/**
 * Versão do RESULTADO — não da consulta.
 *
 * O snapshot é chaveado pela config, então mudar só o código que monta o valor
 * (rótulo de coluna, tradução de código para nome, formato de data) deixava o
 * dashboard servindo o resultado antigo indefinidamente: a config não mudou,
 * logo a chave não mudou. Quem via "27600" continuava vendo "27600" mesmo
 * depois da correção que traz "REDECARD…".
 *
 * Suba este número sempre que mudar a FORMA do valor devolvido por
 * `toWidgetValue` ou pelo `buildOracleQuery` (colunas, rótulos, formatação).
 * Todas as chaves mudam, os snapshots antigos deixam de casar e cada widget
 * recalcula uma vez — o dashboard se conserta sozinho no primeiro acesso.
 *
 *   2 — join de domínio no agrupamento/detalhamento (código → nome) e
 *       MIN/MAX de data saindo como data em vez de zero.
 *   3 — coluna extra do cadastro na TABLE (ex.: "Unidade" do produto).
 */
const RENDER_VERSION = 3;

/**
 * Identidade estável de uma consulta. Chaves ordenadas para que a mesma
 * consulta escrita em ordem diferente colapse no mesmo snapshot/single-flight.
 * Inclui `organizationId` — snapshot é compartilhado dentro da org, nunca entre.
 */
export function queryFingerprint(
  organizationId: string,
  config: OracleQueryConfig,
  displayType: OracleDisplayType,
): string {
  return createHash("sha256")
    .update(
      `v${RENDER_VERSION}|${organizationId}|${displayType}|${canonicalize(config)}`,
    )
    .digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Célula de uma medida na TABLE. MIN/MAX sobre coluna de data devolvem um
 * `Date` do driver — passar isso por `toNumber` viraria 0 silenciosamente
 * (foi assim que "Última compra" aparecia zerada). Data vira string formatada;
 * a TableWidget renderiza célula string como veio.
 */
function toMeasureCell(value: unknown): string | number {
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  return toNumber(value);
}

function toWidgetValue(
  config: OracleQueryConfig,
  displayType: OracleDisplayType,
  groupLabel: string | null,
  groupExtraLabel: string | null,
  rows: Record<string, unknown>[],
): WidgetValue {
  const first = config.measures[0];

  if (displayType === "STAT") {
    return {
      kind: "STAT",
      value: toNumber(rows[0]?.M0),
      unit: first.unit,
    };
  }

  if (displayType === "CHART") {
    return {
      kind: "CHART",
      series: rows.map((row) => ({
        label: String(row.G ?? "—"),
        value: toNumber(row.M0),
      })),
    };
  }

  if (displayType === "LIST") {
    return {
      kind: "LIST",
      items: rows.map((row, index) => ({
        id: `${row.GID ?? row.G ?? index}`,
        label: String(row.G ?? "—"),
        value: toNumber(row.M0),
        unit: first.unit,
        rank: index + 1,
      })),
    };
  }

  // Coluna extra do cadastro (ex.: "Unidade") entra logo depois do rótulo do
  // grupo — só na TABLE, porque STAT/LIST/CHART exibem um valor por linha e
  // não teriam onde mostrá-la.
  return {
    kind: "TABLE",
    columns: [
      ...(groupLabel
        ? [{ key: "G", label: groupLabel, align: "left" as const }]
        : []),
      ...(groupExtraLabel
        ? [{ key: "GX", label: groupExtraLabel, align: "left" as const }]
        : []),
      ...config.measures.map((measure, index) => ({
        key: `M${index}`,
        label: measure.label,
        align: "right" as const,
        unit: measure.unit,
      })),
    ],
    rows: rows.map((row, index) => ({
      id: `${row.GID ?? row.G ?? index}`,
      cells: [
        ...(groupLabel ? [String(row.G ?? "—")] : []),
        ...(groupExtraLabel ? [row.GX == null ? "—" : String(row.GX)] : []),
        ...config.measures.map((_, position) =>
          toMeasureCell(row[`M${position}`]),
        ),
      ],
    })),
  };
}

export class OracleQueryRefusedError extends Error {
  constructor(reasons: string[]) {
    super(reasons.join(" "));
    this.name = "OracleQueryRefusedError";
  }
}

// Single-flight: N widgets/abas pedindo a MESMA consulta ao mesmo tempo
// colapsam em uma execução só contra o Oracle.
const inFlight = new Map<string, Promise<RunQueryResult>>();

async function execute(
  organizationId: string,
  config: OracleQueryConfig,
  displayType: OracleDisplayType,
): Promise<RunQueryResult> {
  const dictionary = await loadSchemaDictionary(organizationId);

  // Pré-voo roda aqui também, não só na UI: config salva pode ter virado
  // inválida (tabela removida, índice dropado) depois de criada.
  const preflight = preflightOracleQuery(dictionary, config);
  if (!preflight.ok) throw new OracleQueryRefusedError(preflight.errors);

  const { sql, binds, groupLabel, groupExtraLabel } = buildOracleQuery(
    dictionary,
    config,
  );
  const oracleConfig = await loadOracleConfig(organizationId);

  const startedAt = Date.now();
  const rows = await withOracleReadOnly(
    oracleConfig,
    (_query, session) =>
      session.queryCapped<Record<string, unknown>>(sql, MAX_ROWS, binds),
    { callTimeoutMs: QUERY_TIMEOUT_MS },
  );
  const elapsedMs = Date.now() - startedAt;

  return {
    value: toWidgetValue(
      config,
      displayType,
      groupLabel,
      groupExtraLabel,
      rows,
    ),
    rowCount: rows.length,
    elapsedMs,
  };
}

export function runOracleQuery(
  organizationId: string,
  config: OracleQueryConfig,
  displayType: OracleDisplayType,
): Promise<RunQueryResult> {
  const fingerprint = queryFingerprint(organizationId, config, displayType);
  const running = inFlight.get(fingerprint);
  if (running) return running;

  const promise = execute(organizationId, config, displayType).finally(() => {
    inFlight.delete(fingerprint);
  });
  inFlight.set(fingerprint, promise);
  return promise;
}
