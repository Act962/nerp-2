"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useMediaTypes,
  useNegotiationTypes,
  useStoreSectors,
} from "@/features/trade-catalog/hooks/use-trade-catalog";
import { ListFilter } from "lucide-react";
import {
  hasActiveFilters,
  useMapFilterStore,
  type HeatMetric,
} from "../engine/map-filter-store";
import { SPACE_STATE_META, SPACE_STATE_ORDER } from "../engine/space-state";
import type { MapSpaceState } from "../engine/types";

const HEAT_METRIC_LABELS: Record<HeatMetric, string> = {
  NONE: "Sem mapa de calor",
  AVG_SALES: "Venda média",
  NEGOTIATED_VALUE: "Valor negociado",
  ACTION_VALUE: "Potencial de receita",
};

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function FilterCheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-2 py-1 text-sm">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      {label}
    </label>
  );
}

export function MapFilterPanel() {
  const { mediaTypes } = useMediaTypes();
  const { negotiationTypes } = useNegotiationTypes();
  const { storeSectors } = useStoreSectors();

  const mediaTypeIds = useMapFilterStore((state) => state.mediaTypeIds);
  const negotiationTypeIds = useMapFilterStore((state) => state.negotiationTypeIds);
  const sectorIds = useMapFilterStore((state) => state.sectorIds);
  const spaceStates = useMapFilterStore((state) => state.spaceStates);
  const minAvgSales = useMapFilterStore((state) => state.minAvgSales);
  const topSellersOnly = useMapFilterStore((state) => state.topSellersOnly);
  const heatMetric = useMapFilterStore((state) => state.heatMetric);
  const setMediaTypeIds = useMapFilterStore((state) => state.setMediaTypeIds);
  const setNegotiationTypeIds = useMapFilterStore(
    (state) => state.setNegotiationTypeIds,
  );
  const setSectorIds = useMapFilterStore((state) => state.setSectorIds);
  const setSpaceStates = useMapFilterStore((state) => state.setSpaceStates);
  const setMinAvgSales = useMapFilterStore((state) => state.setMinAvgSales);
  const setTopSellersOnly = useMapFilterStore((state) => state.setTopSellersOnly);
  const setHeatMetric = useMapFilterStore((state) => state.setHeatMetric);
  const reset = useMapFilterStore((state) => state.reset);

  const filtersActive = hasActiveFilters({
    mediaTypeIds,
    negotiationTypeIds,
    sectorIds,
    spaceStates,
    minAvgSales,
    topSellersOnly,
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ListFilter className="size-4" />
          Filtros
          {filtersActive && (
            <Badge variant="secondary" className="ml-1 size-4 justify-center p-0">
              •
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4" align="start">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Filtros do mapa</span>
          <Button variant="ghost" size="sm" onClick={reset}>
            Limpar
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Tipo de mídia
          </p>
          <div className="max-h-32 overflow-y-auto">
            {mediaTypes.map((mediaType) => (
              <FilterCheckboxRow
                key={mediaType.id}
                label={mediaType.name}
                checked={mediaTypeIds.includes(mediaType.id)}
                onToggle={() => setMediaTypeIds(toggleId(mediaTypeIds, mediaType.id))}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Setor</p>
          <div className="max-h-32 overflow-y-auto">
            {storeSectors.map((sector) => (
              <FilterCheckboxRow
                key={sector.id}
                label={sector.name}
                checked={sectorIds.includes(sector.id)}
                onToggle={() => setSectorIds(toggleId(sectorIds, sector.id))}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Tipo de negociação
          </p>
          <div className="max-h-32 overflow-y-auto">
            {negotiationTypes.map((negotiationType) => (
              <FilterCheckboxRow
                key={negotiationType.id}
                label={negotiationType.name}
                checked={negotiationTypeIds.includes(negotiationType.id)}
                onToggle={() =>
                  setNegotiationTypeIds(
                    toggleId(negotiationTypeIds, negotiationType.id),
                  )
                }
              />
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Estado do espaço
          </p>
          {SPACE_STATE_ORDER.map((state) => (
            <FilterCheckboxRow
              key={state}
              label={`${SPACE_STATE_META[state].dot} ${SPACE_STATE_META[state].label}`}
              checked={spaceStates.includes(state)}
              onToggle={() =>
                setSpaceStates(
                  toggleId(spaceStates, state) as MapSpaceState[],
                )
              }
            />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="min-avg-sales" className="text-xs font-medium text-muted-foreground">
            Venda média mínima (R$)
          </label>
          <Input
            id="min-avg-sales"
            type="number"
            min={0}
            className="h-8 w-28"
            value={minAvgSales ?? ""}
            onChange={(event) =>
              setMinAvgSales(event.target.value ? Number(event.target.value) : null)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Só mais vendidos (top 20%)
          </span>
          <Switch checked={topSellersOnly} onCheckedChange={setTopSellersOnly} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Mapa de calor
          </p>
          <Select value={heatMetric} onValueChange={(value) => setHeatMetric(value as HeatMetric)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(HEAT_METRIC_LABELS) as HeatMetric[]).map((metric) => (
                <SelectItem key={metric} value={metric}>
                  {HEAT_METRIC_LABELS[metric]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
