"use client";

import { useState, useDeferredValue } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import type { CatalogConfig } from "../types";

interface AddProductDialogProps {
  config: CatalogConfig;
  onConfigChange: (changes: Partial<CatalogConfig>) => void;
}

export function AddProductDialog({ config, onConfigChange }: AddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading } = useQuery(
    orpc.products.list.queryOptions({
      input: {
        limit: 30,
        name: deferredSearch || undefined,
      },
      enabled: open,
    }),
  );

  const alreadyAdded = new Set([
    ...config.manuallyAddedIds,
  ]);

  const handleAdd = (id: string) => {
    const newManuallyAdded = [...config.manuallyAddedIds, id];
    const newExcluded = config.excludedProductIds.filter((eid) => eid !== id);
    onConfigChange({ manuallyAddedIds: newManuallyAdded, excludedProductIds: newExcluded });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full mt-1">
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar produto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar produto ao catálogo</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>
          )}
          {!isLoading && data?.products.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado.</p>
          )}
          {data?.products.map((p) => {
            const added = alreadyAdded.has(p.id);
            return (
              <div
                key={p.id}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.sku}</span>
                </div>
                <Button
                  variant={added ? "secondary" : "outline"}
                  size="sm"
                  className="ml-2 shrink-0"
                  disabled={added}
                  onClick={() => handleAdd(p.id)}
                >
                  {added ? "Adicionado" : "Adicionar"}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
