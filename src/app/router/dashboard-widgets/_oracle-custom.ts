import type { WidgetValue } from "@/app/router/dashboard-widgets/_types";
import {
  type OracleQueryConfig,
  oracleQueryConfigSchema,
} from "@/features/dashboard-widgets/lib/oracle-query-config";
import {
  type OracleDisplayType,
  queryFingerprint,
  runOracleQuery,
} from "@/features/erp-sync/server/oracle-explorer/run-query";
import prisma from "@/lib/db";

// Resolução dos widgets de consulta customizada.
//
// REGRA CENTRAL DO DESENHO: renderizar o dashboard NUNCA abre conexão com o
// Oracle. Esta função só lê `OracleWidgetSnapshot`. Quando o snapshot está
// velho, dispara a recomputação em background e devolve o valor antigo
// (stale-while-revalidate) — ninguém fica esperando o ERP.
//
// Consequência: a carga no ERP é (consultas distintas × frequência de
// atualização), independente de quantas abas/monitores estão abertos.

/** Acima disso o snapshot é considerado velho e uma recomputação é agendada. */
export const SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;

export interface OracleWidgetResolution {
  value: WidgetValue | null;
  error: string | null;
  computedAt: Date | null;
  stale: boolean;
}

interface OracleWidgetRow {
  id: string;
  displayType: string;
  options: unknown;
}

function parseConfig(options: unknown): OracleQueryConfig | null {
  const raw = (options as { oracle?: unknown } | null)?.oracle;
  if (!raw) return null;
  const parsed = oracleQueryConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Recomputa e grava o snapshot. Erro vira linha com `error` preenchido em vez
 * de exceção: widget quebrado mostra a mensagem, e o cache negativo impede que
 * ele martele o ERP a cada carregamento.
 */
export async function refreshOracleSnapshot(
  organizationId: string,
  config: OracleQueryConfig,
  displayType: OracleDisplayType,
): Promise<void> {
  const fingerprint = queryFingerprint(organizationId, config, displayType);
  try {
    const result = await runOracleQuery(organizationId, config, displayType);
    await prisma.oracleWidgetSnapshot.upsert({
      where: { organizationId_fingerprint: { organizationId, fingerprint } },
      create: {
        organizationId,
        fingerprint,
        value: result.value as object,
        error: null,
        computedAt: new Date(),
        durationMs: result.elapsedMs,
      },
      update: {
        value: result.value as object,
        error: null,
        computedAt: new Date(),
        durationMs: result.elapsedMs,
      },
    });
  } catch (error) {
    const message = (error as Error).message.slice(0, 300);
    await prisma.oracleWidgetSnapshot.upsert({
      where: { organizationId_fingerprint: { organizationId, fingerprint } },
      create: {
        organizationId,
        fingerprint,
        value: undefined,
        error: message,
        computedAt: new Date(),
      },
      // Mantém o último valor bom: melhor mostrar dado velho com aviso do que
      // esvaziar o widget por uma falha momentânea de rede.
      update: { error: message, computedAt: new Date() },
    });
  }
}

export async function resolveOracleWidgets(
  organizationId: string,
  widgets: OracleWidgetRow[],
): Promise<Map<string, OracleWidgetResolution>> {
  const result = new Map<string, OracleWidgetResolution>();
  if (widgets.length === 0) return result;

  const byFingerprint = new Map<
    string,
    { config: OracleQueryConfig; displayType: OracleDisplayType }
  >();
  const fingerprintByWidget = new Map<string, string>();

  for (const widget of widgets) {
    const config = parseConfig(widget.options);
    if (!config) {
      result.set(widget.id, {
        value: null,
        error: "Consulta não configurada.",
        computedAt: null,
        stale: false,
      });
      continue;
    }
    const displayType = widget.displayType as OracleDisplayType;
    const fingerprint = queryFingerprint(organizationId, config, displayType);
    fingerprintByWidget.set(widget.id, fingerprint);
    byFingerprint.set(fingerprint, { config, displayType });
  }

  if (byFingerprint.size === 0) return result;

  const snapshots = await prisma.oracleWidgetSnapshot.findMany({
    where: { organizationId, fingerprint: { in: [...byFingerprint.keys()] } },
    select: {
      fingerprint: true,
      value: true,
      error: true,
      computedAt: true,
    },
  });
  const snapshotByFingerprint = new Map(
    snapshots.map((snapshot) => [snapshot.fingerprint, snapshot]),
  );

  const now = Date.now();
  const toRefresh: {
    config: OracleQueryConfig;
    displayType: OracleDisplayType;
  }[] = [];

  for (const [widgetId, fingerprint] of fingerprintByWidget) {
    const snapshot = snapshotByFingerprint.get(fingerprint);
    const entry = byFingerprint.get(fingerprint);
    const age = snapshot ? now - snapshot.computedAt.getTime() : Infinity;
    const stale = age > SNAPSHOT_MAX_AGE_MS;

    if (stale && entry) toRefresh.push(entry);

    result.set(widgetId, {
      value: (snapshot?.value as WidgetValue | null) ?? null,
      error: snapshot?.error ?? (snapshot ? null : "Calculando…"),
      computedAt: snapshot?.computedAt ?? null,
      stale,
    });
  }

  // Recomputação em background: a resposta NÃO espera. Deduplicada por
  // fingerprint aqui e novamente pelo single-flight de run-query.ts.
  const unique = new Map(
    toRefresh.map((entry) => [
      queryFingerprint(organizationId, entry.config, entry.displayType),
      entry,
    ]),
  );
  for (const entry of unique.values()) {
    void refreshOracleSnapshot(
      organizationId,
      entry.config,
      entry.displayType,
    ).catch(() => {});
  }

  return result;
}
