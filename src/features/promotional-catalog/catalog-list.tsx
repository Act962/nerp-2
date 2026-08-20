"use client";

import { useState } from "react";
import { Tag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogCard } from "./components/catalog-card";
import {
  usePromotionalCatalogs,
  useCreateCatalog,
  useDuplicateCatalog,
} from "./hooks/use-catalog";

export function CatalogList() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");

  const { data: catalogs, isLoading } = usePromotionalCatalogs();
  const createMutation = useCreateCatalog();
  const duplicateMutation = useDuplicateCatalog();

  const handleCreate = () => {
    if (!newCatalogName.trim()) return;
    createMutation.mutate({ name: newCatalogName.trim() });
    setCreateOpen(false);
    setNewCatalogName("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo Promocional</h1>
          <p className="text-muted-foreground text-sm">
            Crie catálogos visuais de produtos em promoção para divulgar em
            redes sociais.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Catálogo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
          ))}
        </div>
      ) : !catalogs || catalogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="rounded-full bg-muted p-6">
            <Tag className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Nenhum catálogo criado ainda</p>
            <p className="text-sm text-muted-foreground">
              Crie seu primeiro catálogo promocional para começar.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar primeiro catálogo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {catalogs.map((catalog) => (
            <CatalogCard
              key={catalog.id}
              id={catalog.id}
              name={catalog.name}
              thumbnail={catalog.thumbnail}
              updatedAt={catalog.updatedAt}
              duplicating={duplicateMutation.isPending}
              onDuplicate={() => duplicateMutation.mutate({ id: catalog.id })}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo catálogo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="catalog-name">Nome do catálogo</Label>
            <Input
              id="catalog-name"
              value={newCatalogName}
              onChange={(e) => setNewCatalogName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Ex: Promoções de Julho"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newCatalogName.trim() || createMutation.isPending}
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
