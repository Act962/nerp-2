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
import { ChevronDown } from "lucide-react";
import { useState } from "react";

/** Seleção múltipla de lojas/indústrias, com busca. */
export function CalendarTargetPicker({
  label,
  options,
  value,
  onChange,
  emptyLabel,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
}) {
  const [search, setSearch] = useState("");

  const visible = search.trim()
    ? options.filter((option) =>
        option.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : options;

  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );

  return (
    <div className="space-y-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {value.length === 0
                ? emptyLabel
                : `${value.length} selecionado(s)`}
            </span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Buscar ${label.toLowerCase()}…`}
            className="h-9"
          />
          <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
            {visible.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Nada encontrado.
              </p>
            ) : (
              visible.map((option) => {
                const id = `target-${label}-${option.id}`;
                return (
                  <label
                    key={option.id}
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      id={id}
                      checked={value.includes(option.id)}
                      onCheckedChange={() => toggle(option.id)}
                    />
                    <span className="truncate">{option.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((id) => {
            const option = options.find((item) => item.id === id);
            if (!option) return null;
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {option.name}
                <button
                  type="button"
                  aria-label={`Remover ${option.name}`}
                  onClick={() => toggle(id)}
                  className="opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
