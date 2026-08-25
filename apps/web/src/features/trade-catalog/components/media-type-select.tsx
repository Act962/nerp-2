"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Star, Tag } from "lucide-react";
import { useState } from "react";
import {
  useMediaTypes,
  useToggleMediaTypeFavorite,
} from "../hooks/use-trade-catalog";

// Seletor de Tipo de mídia (biblioteca nacional). Favoritos da org aparecem
// primeiro; "Ver todos" abre a lista completa (não carrega tudo de cara). A
// estrela favorita/desfavorita (por org). Reutilizado no card de aprovação de
// fotos e no filtro "Fotos desta loja".
interface MediaTypeSelectProps {
  value: string | null;
  onChange: (mediaTypeId: string | null) => void;
  className?: string;
  disabled?: boolean;
  // Rótulo do estado vazio (ex.: "Tipo de mídia" ou "Filtrar por mídia").
  placeholder?: string;
  // Mostra a opção "Remover categorização/filtro".
  allowClear?: boolean;
}

export function MediaTypeSelect({
  value,
  onChange,
  className,
  disabled,
  placeholder = "Tipo de mídia",
  allowClear = true,
}: MediaTypeSelectProps) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { mediaTypes, isLoading } = useMediaTypes();
  const toggleFavorite = useToggleMediaTypeFavorite();

  const current = mediaTypes.find((m) => m.id === value);
  const favorites = mediaTypes.filter((m) => m.isFavorite);
  const visible = showAll || favorites.length === 0 ? mediaTypes : favorites;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("h-8 justify-between gap-1.5 font-normal", className)}
        >
          <span className="flex items-center gap-1 truncate">
            <Tag className="size-3.5 shrink-0 text-muted-foreground" />
            {current ? (
              <span className="truncate">
                {current.code} · {current.name}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        {isLoading ? (
          <p className="p-2 text-center text-xs text-muted-foreground">
            Carregando…
          </p>
        ) : mediaTypes.length === 0 ? (
          <p className="p-2 text-center text-xs text-muted-foreground">
            Nenhum tipo de mídia cadastrado.
          </p>
        ) : (
          <div className="flex max-h-72 flex-col overflow-y-auto">
            {allowClear && value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
              >
                Remover
              </button>
            )}
            {visible.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex items-center gap-1 rounded hover:bg-muted",
                  m.id === value && "bg-primary/10",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-xs"
                >
                  <span className="font-medium">{m.code}</span> · {m.name}
                </button>
                <button
                  type="button"
                  title={m.isFavorite ? "Remover dos favoritos" : "Favoritar"}
                  disabled={toggleFavorite.isPending}
                  onClick={() =>
                    toggleFavorite.mutate({
                      id: m.id,
                      isFavorite: !m.isFavorite,
                    })
                  }
                  className="p-1.5"
                >
                  <Star
                    className={cn(
                      "size-3.5",
                      m.isFavorite
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/50",
                    )}
                  />
                </button>
              </div>
            ))}
            {favorites.length > 0 && mediaTypes.length > favorites.length && (
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="mt-1 rounded px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-muted"
              >
                {showAll ? "Mostrar só favoritos" : "Ver todos os tipos"}
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
