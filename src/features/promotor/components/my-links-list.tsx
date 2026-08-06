"use client";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScrollSentinel } from "@/hooks/use-infinite-scroll-sentinel";
import { Factory, Star, Store as StoreIcon } from "lucide-react";
import { useState } from "react";
import {
  useMyIndustries,
  useMyStores,
  useTogglePromotorFavorite,
} from "../hooks/use-promotor";

type Row = {
  id: string;
  name: string;
  subtitle?: string | null;
  isFavorite: boolean;
};

function LinkRow({
  row,
  icon,
  onToggle,
}: {
  row: Row;
  icon: React.ReactNode;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-2 border-b px-1 py-2 last:border-0">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.name}</p>
        {row.subtitle && (
          <p className="truncate text-xs text-muted-foreground">
            {row.subtitle}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label={
          row.isFavorite ? `Desfavoritar ${row.name}` : `Favoritar ${row.name}`
        }
        aria-pressed={row.isFavorite}
        onClick={onToggle}
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Star
          className={cn(
            "size-5",
            row.isFavorite && "fill-amber-400 text-amber-500",
          )}
        />
      </button>
    </li>
  );
}

function ListShell({
  rows,
  isLoading,
  search,
  onSearch,
  placeholder,
  emptyLabel,
  icon,
  onToggle,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
}: {
  rows: Row[];
  isLoading: boolean;
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  emptyLabel: string;
  icon: React.ReactNode;
  onToggle: (row: Row) => void;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
}) {
  const favorites = rows.filter((row) => row.isFavorite);
  const others = rows.filter((row) => !row.isFavorite);
  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder={placeholder}
        className="h-11"
      />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        [
          { heading: "Favoritos", items: favorites },
          {
            heading: favorites.length > 0 ? "Demais" : "",
            items: others,
          },
        ]
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <section key={group.heading || "todos"}>
              {group.heading && (
                <h2 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.heading}
                </h2>
              )}
              <ul className="rounded-md border px-2">
                {group.items.map((row) => (
                  <LinkRow
                    key={row.id}
                    row={row}
                    icon={icon}
                    onToggle={() => onToggle(row)}
                  />
                ))}
              </ul>
            </section>
          ))
      )}

      {!isLoading && hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-3">
          {isFetchingNextPage && <Spinner />}
        </div>
      )}
    </div>
  );
}

// Indústrias que o promotor representa. Favoritar aqui é a mesma marcação do
// wizard — muda a ordem lá, não a permissão, que continua vindo do vínculo.
export function MyIndustriesList() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const {
    suppliers,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useMyIndustries(debounced || undefined);
  const toggleFavorite = useTogglePromotorFavorite();

  return (
    <ListShell
      rows={suppliers.map((item) => ({
        id: item.id,
        name: item.name,
        // Mesmo aviso do wizard: aqui ele descobre antes de estar na loja,
        // com tempo de pedir o selo à coordenação.
        subtitle: item.actionCodeImage
          ? null
          : "Sem senha do mês — solicite à coordenação",
        isFavorite: item.isFavorite,
      }))}
      isLoading={isLoading}
      search={search}
      onSearch={setSearch}
      placeholder="Buscar indústria…"
      emptyLabel="Nenhuma indústria vinculada a você."
      icon={<Factory className="size-5" />}
      onToggle={(row) =>
        toggleFavorite.mutate({
          type: "supplier",
          id: row.id,
          favorite: !row.isFavorite,
        })
      }
      hasNextPage={!!hasNextPage}
      fetchNextPage={() => fetchNextPage()}
      isFetchingNextPage={isFetchingNextPage}
    />
  );
}

export function MyClientsList() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);
  const { stores, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useMyStores(debounced || undefined);
  const toggleFavorite = useTogglePromotorFavorite();

  return (
    <ListShell
      rows={stores.map((item) => ({
        id: item.id,
        name: item.name,
        subtitle: [item.city, item.state].filter(Boolean).join(" / ") || null,
        isFavorite: item.isFavorite,
      }))}
      isLoading={isLoading}
      search={search}
      onSearch={setSearch}
      placeholder="Buscar cliente…"
      emptyLabel="Nenhum cliente encontrado."
      icon={<StoreIcon className="size-5" />}
      onToggle={(row) =>
        toggleFavorite.mutate({
          type: "store",
          id: row.id,
          favorite: !row.isFavorite,
        })
      }
      hasNextPage={!!hasNextPage}
      fetchNextPage={() => fetchNextPage()}
      isFetchingNextPage={isFetchingNextPage}
    />
  );
}
