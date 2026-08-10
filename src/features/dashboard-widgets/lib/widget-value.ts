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
      kind: "MAP";
      scope: "field";
      pins: {
        id: string;
        lat: number;
        lng: number;
        label: string;
        type: "store" | "promoter";
        detail?: string;
      }[];
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
    }
  // Frota: uma linha por caminhão, com barra de ocupação de carga. Renderer
  // dedicado (FleetWidget) — não cabe na TABLE genérica por causa da barra e
  // do badge de status.
  | {
      kind: "FLEET";
      trucks: {
        id: string;
        plate: string;
        driver: string;
        route: string;
        /** Ocupação de carga 0–100. */
        loadPercent: number;
        eta?: string;
        status?: string;
        statusTone?: WidgetTone;
      }[];
    }
  // Feed de alertas (IA operacional): itens com tom, título, subtítulo e hora.
  | {
      kind: "FEED";
      items: {
        id: string;
        tone: WidgetTone;
        title: string;
        subtitle?: string;
        time?: string;
      }[];
    };

// Tom semântico compartilhado por FLEET (badge) e FEED (ícone/cor).
export type WidgetTone = "info" | "success" | "warning" | "danger" | "neutral";

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
