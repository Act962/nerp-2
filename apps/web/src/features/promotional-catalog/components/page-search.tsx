"use client";

import { useMemo, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

// Busca de PÁGINA dentro do catálogo (padrão do sistema: InputGroup + lupa).
// Digitar filtra as páginas pelo nome; clicar/Enter salta para a página.
export function PageSearch({
  pages,
  onJump,
  className,
}: {
  pages: { id: string; name: string }[];
  onJump: (index: number) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pages
      .map((p, index) => ({ ...p, index }))
      .filter((p) =>
        (p.name || `Página ${p.index + 1}`).toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [pages, query]);

  const jump = (index: number) => {
    onJump(index);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Buscar página..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Atraso: deixa o onClick do item disparar antes de fechar.
            closeTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              jump(matches[0].index);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </InputGroup>
      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {matches.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Nenhuma página encontrada
            </p>
          ) : (
            matches.map((m) => (
              <button
                key={m.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  // Evita o blur do input antes do clique registrar.
                  e.preventDefault();
                  if (closeTimer.current) clearTimeout(closeTimer.current);
                }}
                onClick={() => jump(m.index)}
              >
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {m.index + 1}
                </span>
                <span className="truncate">
                  {m.name || `Página ${m.index + 1}`}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
