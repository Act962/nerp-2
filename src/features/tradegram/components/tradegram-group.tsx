"use client";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { usePublicGroup } from "../hooks/use-tradegram";
import { TradeGramFooter } from "./tradegram-footer";
import { TradeGramHeader } from "./tradegram-header";
import { UnitTile } from "./unit-tile";

export function TradeGramGroup({ orgSlug }: { orgSlug: string }) {
  const { data, isPending, isError } = usePublicGroup(orgSlug);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 200);

  const stores = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    if (!data) return [];
    if (!term) return data.stores;
    return data.stores.filter(
      (store) =>
        store.name.toLowerCase().includes(term) ||
        (store.city ?? "").toLowerCase().includes(term),
    );
  }, [data, debounced]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-muted-foreground">
        Perfil não encontrado ou não está público.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <TradeGramHeader
        logoKey={data.header.logoKey}
        name={data.header.name}
        handle={data.header.handle}
        subtitle={data.header.tradeName}
        stats={[
          { value: data.stats.pdvs, label: "pdvs", tone: "brand" },
          { value: data.stats.checkouts, label: "Checkouts" },
          { value: data.stats.industrias, label: "Indústrias" },
          { value: data.stats.espacos, label: "Espaços" },
        ]}
      />

      <div className="px-4 pb-4">
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar loja"
            className="pl-9"
          />
        </div>
      </div>

      {stores.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground text-sm">
          Nenhuma loja encontrada.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3">
          {stores.map((store) => (
            <UnitTile
              key={store.id}
              orgSlug={orgSlug}
              groupName={data.header.name}
              logoKey={data.header.logoKey}
              store={store}
            />
          ))}
        </div>
      )}

      <TradeGramFooter />
    </div>
  );
}
