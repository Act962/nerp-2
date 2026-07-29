// Espelha src/app/router/dashboard-widgets/_types.ts (server-only, não pode
// ser importado direto do client) — mesmo padrão de SalesGoalRankEntry em
// sales-goal-podium.tsx: tipo espelhado à mão em vez de importar o arquivo
// do servidor.
export type WidgetValue =
  | {
      kind: "STAT";
      value: number;
      unit?: "currency" | "number" | "percent";
      deltaLabel?: string;
    }
  | {
      kind: "CHART";
      series: { label: string; value: number }[];
    }
  | {
      kind: "LIST";
      items: {
        id: string;
        label: string;
        value: number;
        unit?: "currency" | "number" | "percent";
        meta?: string;
        rank?: number;
      }[];
    }
  | {
      kind: "MAP";
      scope: "state" | "piaui-municipio";
      regions: { id: string; label: string; value: number }[];
    }
  | {
      kind: "TABLE";
      columns: {
        key: string;
        label: string;
        align: "left" | "right";
        unit?: "currency" | "number" | "percent";
      }[];
      rows: { id: string; cells: (string | number | null)[] }[];
    };

export function formatWidgetValue(
  value: number,
  unit?: "currency" | "number" | "percent",
): string {
  if (unit === "currency") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  if (unit === "percent") {
    return `${value.toFixed(0)}%`;
  }
  return value.toLocaleString("pt-BR");
}
