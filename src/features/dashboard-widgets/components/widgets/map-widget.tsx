"use client";

import { useMemo } from "react";
import {
  BRAZIL_STATES_PATHS,
  BRAZIL_STATES_VIEW_BOX,
} from "../../lib/geo/brazil-states.paths";
import {
  PIAUI_MUNICIPIOS_PATHS,
  PIAUI_MUNICIPIOS_VIEW_BOX,
} from "../../lib/geo/piaui-municipios.paths";
import { formatWidgetValue, type WidgetValue } from "../../lib/widget-value";

// Estado/cidade chegam de texto livre (ViaCEP autopreenche, mas é editável
// depois) — normaliza maiúsculas/acentos pra casar com o nome oficial do
// GeoJSON sem exigir grafia idêntica.
function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

// Rampa sequencial de uma cor só (mesmo tom do resto dos gráficos,
// var(--chart-1)) variando opacidade — um choropleth não precisa de mais que
// isso, e evita inventar uma paleta nova só pra este widget.
const OPACITY_STEPS = [0.15, 0.35, 0.55, 0.75, 1];

export function MapWidget({
  value,
}: {
  value: Extract<WidgetValue, { kind: "MAP" }>;
}) {
  const { paths, viewBox } =
    value.scope === "state"
      ? { paths: BRAZIL_STATES_PATHS, viewBox: BRAZIL_STATES_VIEW_BOX }
      : { paths: PIAUI_MUNICIPIOS_PATHS, viewBox: PIAUI_MUNICIPIOS_VIEW_BOX };

  const valueByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const region of value.regions) {
      map.set(normalizeKey(region.id), region.value);
    }
    return map;
  }, [value.regions]);

  const maxValue = Math.max(0, ...value.regions.map((region) => region.value));

  if (value.regions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma venda com região identificada ainda.
      </p>
    );
  }

  return (
    <svg
      viewBox={viewBox}
      className="h-full w-full"
      role="img"
      aria-label="Mapa de vendas por região"
    >
      {paths.map((path) => {
        const regionValue = valueByKey.get(normalizeKey(path.id));
        const ratio = regionValue && maxValue > 0 ? regionValue / maxValue : 0;
        const step =
          ratio > 0
            ? OPACITY_STEPS[
                Math.min(
                  OPACITY_STEPS.length - 1,
                  Math.floor(ratio * OPACITY_STEPS.length),
                )
              ]
            : 0;
        return (
          <path
            key={path.id}
            d={path.d}
            fillRule="evenodd"
            fill={step > 0 ? "var(--chart-1)" : "var(--muted)"}
            fillOpacity={step > 0 ? step : 1}
            stroke="var(--border)"
            strokeWidth={0.75}
          >
            <title>
              {path.name}
              {regionValue
                ? `: ${formatWidgetValue(regionValue, "currency")}`
                : ""}
            </title>
          </path>
        );
      })}
    </svg>
  );
}
