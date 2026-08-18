import type { WidgetValue } from "./widget-value";

// Converte qualquer WidgetValue numa tabela genérica, para o popup de detalhe
// conseguir listar os dados de qualquer widget com o mesmo componente.
//
// Não busca nada: usa o valor que o widget JÁ tem em mãos. Isso mantém a
// garantia central do desenho (abrir widget não bate no ERP do cliente) e
// significa que o popup mostra exatamente o que alimentou o gráfico/card —
// se a consulta limita a 20 linhas, são essas 20 que aparecem aqui.

export interface DetailColumn {
  key: string;
  label: string;
  align: "left" | "right";
  unit?: "currency" | "number" | "percent";
}

export interface DetailRow {
  id: string;
  cells: (string | number | null)[];
}

export interface DetailTable {
  columns: DetailColumn[];
  rows: DetailRow[];
}

export function widgetValueToTable(value: WidgetValue): DetailTable {
  switch (value.kind) {
    case "STAT":
      return {
        columns: [
          { key: "label", label: "Métrica", align: "left" },
          { key: "value", label: "Valor", align: "right", unit: value.unit },
        ],
        rows: [
          {
            id: "stat",
            cells: [value.deltaLabel ?? "Valor atual", value.value],
          },
        ],
      };

    case "CHART":
      return {
        columns: [
          { key: "label", label: "Período", align: "left" },
          { key: "value", label: "Valor", align: "right" },
        ],
        rows: value.series.map((point, index) => ({
          id: `${point.label}-${index}`,
          cells: [point.label, point.value],
        })),
      };

    case "LIST":
      return {
        columns: [
          { key: "rank", label: "#", align: "left" },
          { key: "label", label: "Item", align: "left" },
          { key: "meta", label: "Detalhe", align: "left" },
          { key: "value", label: "Valor", align: "right" },
        ],
        rows: value.items.map((item, index) => ({
          id: item.id,
          cells: [
            item.rank ?? index + 1,
            item.label,
            item.meta ?? "—",
            item.value,
          ],
        })),
      };

    case "MAP":
      if (value.scope === "field") {
        return {
          columns: [
            { key: "label", label: "Nome", align: "left" },
            { key: "type", label: "Tipo", align: "left" },
            { key: "detail", label: "Local", align: "left" },
          ],
          rows: value.pins.map((pin) => ({
            id: pin.id,
            cells: [
              pin.label,
              pin.type === "store" ? "Cliente" : "Usuário",
              pin.detail ?? "—",
            ],
          })),
        };
      }
      return {
        columns: [
          { key: "region", label: "Região", align: "left" },
          {
            key: "value",
            label: "Valor",
            align: "right",
            unit: "currency",
          },
        ],
        rows: [...value.regions]
          .sort((a, b) => b.value - a.value)
          .map((region) => ({
            id: region.id,
            cells: [region.label, region.value],
          })),
      };

    case "TABLE":
      return { columns: value.columns, rows: value.rows };

    case "FLEET":
      return {
        columns: [
          { key: "plate", label: "Placa", align: "left" },
          { key: "driver", label: "Motorista", align: "left" },
          { key: "route", label: "Rota", align: "left" },
          { key: "status", label: "Status", align: "left" },
          { key: "load", label: "Carga", align: "right", unit: "percent" },
        ],
        rows: value.trucks.map((truck) => ({
          id: truck.id,
          cells: [
            truck.plate,
            truck.driver,
            truck.route,
            truck.status ?? "—",
            truck.loadPercent,
          ],
        })),
      };

    case "FEED":
      return {
        columns: [
          { key: "time", label: "Hora", align: "left" },
          { key: "title", label: "Alerta", align: "left" },
          { key: "subtitle", label: "Detalhe", align: "left" },
        ],
        rows: value.items.map((item) => ({
          id: item.id,
          cells: [item.time ?? "—", item.title, item.subtitle ?? "—"],
        })),
      };
  }
}
