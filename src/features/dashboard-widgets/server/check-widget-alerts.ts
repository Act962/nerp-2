import "server-only";

import prisma from "@/lib/db";
import { isOracleWidget } from "@/app/router/dashboard-widgets/_oracle-widget";
import { resolveOracleWidgets } from "@/app/router/dashboard-widgets/_oracle-custom";
import {
  parseManualMetricId,
  resolveManualMetricValue,
  WIDGET_REGISTRY,
} from "@/app/router/dashboard-widgets/_registry";
import type { WidgetValue } from "@/app/router/dashboard-widgets/_types";
import {
  ALERT_TOLERANCE_MINUTES,
  compareAlertValue,
  readAlert,
  type WidgetAlert,
} from "@/features/dashboard-widgets/lib/widget-alert";

// Verificação de alertas do dashboard.
//
// Rodada por um cron do Inngest (não por endpoint HTTP nem por polling do
// cliente). O objetivo é: um único cron leve percorre TODOS os widgets
// habilitados; deduplica por consulta (widgets Oracle que compartilham
// fingerprint são resolvidos uma vez); nunca abre conexão com o Oracle —
// só lê o snapshot que a fila já preencheu.
//
// Deduplicação de disparo: `lastFiredAt` no próprio `options.alert`. Se já
// disparou hoje, não redispara — evita spam se o cron rodar 3x dentro da
// janela de tolerância.

/** Fuso padrão de disparo. Combina com o resto do sistema (`erpSyncSchedule`). */
const ALERT_TZ = "America/Fortaleza";

interface OrgTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
  isoDate: string;
}

/** Converte `Date` para os componentes locais na TZ do alerta. */
function toOrgTime(now: Date): OrgTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ALERT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const weekdayShort = parts.find((part) => part.type === "weekday")?.value;
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOfWeek = WEEKDAYS.indexOf(weekdayShort ?? "Sun");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    dayOfWeek,
    isoDate: `${get("year")}-${String(get("month")).padStart(2, "0")}-${String(get("day")).padStart(2, "0")}`,
  };
}

/**
 * Diferença em minutos entre `time` (HH:mm) e o momento atual (na TZ da org).
 * Positivo = tempo atual passou do agendado. Nunca negativo (cron olha para
 * trás, não para frente).
 */
function minutesSinceScheduled(scheduledTime: string, now: OrgTime): number {
  const [h, m] = scheduledTime.split(":").map(Number);
  const scheduledMin = h * 60 + m;
  const nowMin = now.hour * 60 + now.minute;
  return nowMin - scheduledMin;
}

/**
 * Já disparou hoje? Compara `lastFiredAt` (ISO UTC) com a data local da org.
 * Simples porque um alerta só dispara uma vez por dia neste MVP — se no
 * futuro suportarmos múltiplos horários por dia, precisa refinar.
 */
function firedTodayAlready(alert: WidgetAlert, today: OrgTime): boolean {
  if (!alert.lastFiredAt) return false;
  const fired = toOrgTime(new Date(alert.lastFiredAt));
  return fired.isoDate === today.isoDate;
}

interface WidgetRow {
  id: string;
  organizationId: string;
  dataSourceKey: string;
  displayType: string;
  options: unknown;
}

interface EvaluatedAlert {
  widgetId: string;
  organizationId: string;
  observedValue: number;
  firedAt: Date;
}

/**
 * Roda a checagem inteira. Devolve a lista de alertas que dispararam para
 * quem chamou logar; a atualização do `options.alert.lastFiredAt` já é feita
 * aqui dentro (não pode ser feita pelo caller sem duplicar o join).
 */
export async function checkWidgetAlerts(
  now: Date = new Date(),
): Promise<EvaluatedAlert[]> {
  const orgTime = toOrgTime(now);

  // Puxa TODOS os widgets com alerta habilitado — sem filtro por horário na
  // query (não dá para indexar dentro de JSON portátil entre Postgres 15/17).
  // Filtramos em memória; volume é baixo (dashboards por organização).
  //
  // Prisma não sabe consultar dentro do JSON `options` de forma tipada, então
  // buscamos todos os widgets do member (que já tem member×org) — o filtro
  // real acontece abaixo.
  const widgets = (await prisma.dashboardWidget.findMany({
    where: {
      // Postgres JSONB: `path` compatível com Prisma 7. Corta a maior parte da
      // varredura no banco em vez de fazer no Node.
      options: { path: ["alert", "enabled"], equals: true },
    },
    select: {
      id: true,
      dataSourceKey: true,
      displayType: true,
      options: true,
      member: { select: { organizationId: true } },
    },
  })) as unknown as Array<{
    id: string;
    dataSourceKey: string;
    displayType: string;
    options: unknown;
    member: { organizationId: string };
  }>;

  if (widgets.length === 0) return [];

  const rows: WidgetRow[] = widgets.map((widget) => ({
    id: widget.id,
    organizationId: widget.member.organizationId,
    dataSourceKey: widget.dataSourceKey,
    displayType: widget.displayType,
    options: widget.options,
  }));

  // 1) Filtra por horário: cai na janela de tolerância + dia da semana OK +
  // não disparou hoje.
  const dueRows = rows.filter((widget) => {
    const alert = readAlert(widget.options);
    if (!alert.enabled) return false;
    // Só STAT tem valor único comparável. Chart/List/Table não têm "um
    // número"; o esquema poderia agregar (soma), mas isso confunde — o MVP
    // deixa fora e a UI já esconde a seção para os outros tipos.
    if (widget.displayType !== "STAT") return false;
    if (
      alert.daysOfWeek.length > 0 &&
      !alert.daysOfWeek.includes(orgTime.dayOfWeek)
    ) {
      return false;
    }
    const diff = minutesSinceScheduled(alert.time, orgTime);
    if (diff < 0 || diff > ALERT_TOLERANCE_MINUTES) return false;
    if (firedTodayAlready(alert, orgTime)) return false;
    return true;
  });

  if (dueRows.length === 0) return [];

  // 2) Resolve valores. Oracle usa cache de snapshot (nunca bate no ERP aqui,
  // é a mesma regra do dashboard). Nativo/manual roda o resolver da fonte.
  const valueByWidgetId = new Map<string, WidgetValue | null>();

  const oracleRows = dueRows.filter((row) => isOracleWidget(row.dataSourceKey));
  const byOrgOracle = new Map<string, typeof oracleRows>();
  for (const row of oracleRows) {
    const list = byOrgOracle.get(row.organizationId) ?? [];
    list.push(row);
    byOrgOracle.set(row.organizationId, list);
  }
  for (const [organizationId, list] of byOrgOracle) {
    const resolved = await resolveOracleWidgets(organizationId, list);
    for (const [widgetId, entry] of resolved) {
      valueByWidgetId.set(widgetId, entry.value);
    }
  }

  for (const row of dueRows) {
    if (isOracleWidget(row.dataSourceKey)) continue;
    const manualId = parseManualMetricId(row.dataSourceKey);
    try {
      if (manualId) {
        valueByWidgetId.set(
          row.id,
          await resolveManualMetricValue(row.organizationId, manualId),
        );
      } else {
        const definition = WIDGET_REGISTRY[row.dataSourceKey];
        if (definition) {
          valueByWidgetId.set(
            row.id,
            await definition.resolve({ organizationId: row.organizationId }),
          );
        }
      }
    } catch {
      // Falha ao resolver não deve travar o cron; simplesmente não dispara.
      valueByWidgetId.set(row.id, null);
    }
  }

  // 3) Compara e persiste.
  const fired: EvaluatedAlert[] = [];
  for (const row of dueRows) {
    const value = valueByWidgetId.get(row.id);
    if (!value || value.kind !== "STAT") continue;

    const alert = readAlert(row.options);
    const options = (row.options as Record<string, unknown> | null) ?? {};
    const target =
      typeof (options as { targetValue?: unknown }).targetValue === "number"
        ? ((options as { targetValue: number }).targetValue as number)
        : null;

    if (!compareAlertValue(value.value, alert, target)) continue;

    const firedAt = new Date(now);
    const nextAlert: WidgetAlert = {
      ...alert,
      lastFiredAt: firedAt.toISOString(),
      lastFiredValue: value.value,
    };

    // Grava só o `alert` do options — não sobrepomos oracle/appearance/etc.
    // Cast para o formato que o Prisma aceita como JSONB: `WidgetAlert` é uma
    // interface estrita, então precisa passar pelo `Record<string, unknown>`
    // (que casa com `InputJsonObject`).
    const nextOptions: Record<string, unknown> = {
      ...(options as Record<string, unknown>),
      alert: nextAlert as unknown as Record<string, unknown>,
    };
    await prisma.dashboardWidget.update({
      where: { id: row.id },
      data: {
        options:
          nextOptions as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue,
      },
    });

    fired.push({
      widgetId: row.id,
      organizationId: row.organizationId,
      observedValue: value.value,
      firedAt,
    });
  }

  return fired;
}
