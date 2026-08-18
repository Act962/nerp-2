"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useSceneStore } from "../engine/scene-store";
import type { MapObjectType } from "../engine/types";

const TYPE_LABELS: Record<MapObjectType, string> = {
  WALL: "Parede",
  AISLE: "Corredor",
  SECTOR: "Setor",
  GONDOLA: "Gôndola",
  ISLAND: "Ilha",
  CHECKOUT: "Caixa",
  ENTRANCE: "Entrada",
  EXIT: "Saída",
  DEPOSIT: "Depósito",
  RESTRICTED_AREA: "Área restrita",
  PIN: "Pin",
  TEXT: "Texto",
};

// Gôndolas e ilhas são o alvo do promotor; o resto vem depois na lista.
const PRIORITY: Partial<Record<MapObjectType, number>> = {
  GONDOLA: 0,
  ISLAND: 1,
};

interface MapObjectSearchProps {
  onSelected?: () => void;
}

export function MapObjectSearch({ onSelected }: MapObjectSearchProps) {
  const objects = useSceneStore((state) => state.objects);
  const selectedIds = useSceneStore((state) => state.selectedIds);
  const focusObject = useSceneStore((state) => state.focusObject);
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    // Elementos sem nome também entram na lista: no mapa recém-desenhado quase
    // nada tem nome, e sem isso a lista fica vazia justamente para quem não sabe
    // o que pesquisar. Recebem um rótulo automático por tipo.
    const counters = new Map<MapObjectType, number>();

    return Object.values(objects)
      .sort((a, b) => {
        const rank = (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9);
        if (rank !== 0) return rank;
        return (a.name ?? "").localeCompare(b.name ?? "", "pt-BR");
      })
      .map((object) => {
        const position = (counters.get(object.type) ?? 0) + 1;
        counters.set(object.type, position);
        return {
          id: object.id,
          label: object.name ?? `${TYPE_LABELS[object.type]} ${position}`,
          unnamed: !object.name,
          type: object.type,
          category: object.category,
        };
      });
  }, [objects]);

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  const handleSelect = (id: string) => {
    focusObject(id);
    setOpen(false);
    onSelected?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start gap-2 font-normal text-muted-foreground sm:w-72"
        >
          <SearchIcon className="size-4 shrink-0" />
          Buscar ou escolher elemento...
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Busque ou escolha na lista..." />
          <CommandList>
            <CommandEmpty>Nenhum elemento encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.category ?? ""}`}
                  onSelect={() => handleSelect(option.id)}
                >
                  <Check
                    className={cn(
                      "size-4",
                      selectedId === option.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span
                      className={cn(option.unnamed && "text-muted-foreground")}
                    >
                      {option.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {TYPE_LABELS[option.type]}
                      {option.category ? ` · ${option.category}` : ""}
                      {option.unnamed ? " · sem nome" : ""}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
