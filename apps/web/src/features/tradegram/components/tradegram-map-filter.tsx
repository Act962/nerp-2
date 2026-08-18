"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMapFilterStore } from "@/features/store-map/engine/map-filter-store";
import {
  SPACE_STATE_META,
  SPACE_STATE_ORDER,
} from "@/features/store-map/engine/space-state";
import { ListFilter } from "lucide-react";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

// Filtro público do mapa: só tipo de mídia e estado do espaço (dados públicos).
// Sem os filtros sensíveis do editor (vendas, top sellers, negociação).
export function TradegramMapFilter({
  mediaTypes,
}: {
  mediaTypes: { id: string; name: string }[];
}) {
  const mediaTypeIds = useMapFilterStore((state) => state.mediaTypeIds);
  const spaceStates = useMapFilterStore((state) => state.spaceStates);
  const setMediaTypeIds = useMapFilterStore((state) => state.setMediaTypeIds);
  const setSpaceStates = useMapFilterStore((state) => state.setSpaceStates);

  const activeCount = mediaTypeIds.length + spaceStates.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ListFilter className="size-4" /> Filtros
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 font-semibold text-primary-foreground text-xs">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="space-y-1.5">
          <p className="font-medium text-sm">Estado</p>
          {SPACE_STATE_ORDER.map((state) => (
            <div key={state} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={`state-${state}`}
                checked={spaceStates.includes(state)}
                onCheckedChange={() =>
                  setSpaceStates(toggle(spaceStates, state))
                }
              />
              <label
                htmlFor={`state-${state}`}
                className="flex-1 cursor-pointer"
              >
                {SPACE_STATE_META[state].dot} {SPACE_STATE_META[state].label}
              </label>
            </div>
          ))}
        </div>

        {mediaTypes.length > 0 && (
          <div className="space-y-1.5">
            <p className="font-medium text-sm">Tipo de mídia</p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {mediaTypes.map((media) => (
                <div key={media.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={`media-${media.id}`}
                    checked={mediaTypeIds.includes(media.id)}
                    onCheckedChange={() =>
                      setMediaTypeIds(toggle(mediaTypeIds, media.id))
                    }
                  />
                  <label
                    htmlFor={`media-${media.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    {media.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setMediaTypeIds([]);
              setSpaceStates([]);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
