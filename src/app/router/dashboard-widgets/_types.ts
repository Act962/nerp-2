// Shape uniforme que todo resolver de widget devolve — a UI dispatcha em cima
// de `kind`, não de `dataSourceKey`, então StatWidget/ChartWidget/ListWidget
// não precisam saber de onde o dado veio (nativo, ranking, ERP ou manual).
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

export interface ResolveContext {
  organizationId: string;
}
