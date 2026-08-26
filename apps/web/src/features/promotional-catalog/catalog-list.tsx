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
import { cn } from "@/lib/utils";
import { CatalogCard } from "./components/catalog-card";
import {
  usePromotionalCatalogs,
  useCanEditCatalog,
  useCatalogThumbnails,
  useCreateCatalog,
  useDuplicateCatalog,
  useCatalogTemplates,
} from "./hooks/use-catalog";

export function CatalogList() {
  const [createOpen, setCreateOpen] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);

  // Sem a ação de editar, a listagem vira consulta (criar fica desabilitado).
  const canEdit = useCanEditCatalog();
  const { data: catalogs, isLoading } = usePromotionalCatalogs();
  // Miniaturas em query separada — não bloqueiam a grade (aparecem depois).
  const { data: thumbs } = useCatalogThumbnails();
  const thumbMap = new Map((thumbs ?? []).map((t) => [t.id, t.thumbnail]));
  const { data: templatesData } = useCatalogTemplates();
  // "+ Novo catálogo" pode partir de qualquer padrão: da organização + do sistema.
  const templates = templatesData
    ? [...templatesData.mine, ...templatesData.system]
    : undefined;
  const createMutation = useCreateCatalog();
  const duplicateMutation = useDuplicateCatalog();

  const handleCreate = () => {
    if (!newCatalogName.trim()) return;
    const template = templates?.find((t) => t.id === templateId);
    createMutation.mutate({
      name: newCatalogName.trim(),
      ...(template
        ? { config: template.config as Record<string, unknown> }
        : {}),
    });
    setCreateOpen(false);
    setNewCatalogName("");
    setTemplateId(null);
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
        <Button onClick={() => setCreateOpen(true)} disabled={!canEdit}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Catálogo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
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
          <Button onClick={() => setCreateOpen(true)} disabled={!canEdit}>
            <Plus className="h-4 w-4 mr-2" />
            Criar primeiro catálogo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {catalogs.map((catalog) => (
            <CatalogCard
              key={catalog.id}
              id={catalog.id}
              name={catalog.name}
              thumbnail={thumbMap.get(catalog.id) ?? null}
              updatedAt={catalog.updatedAt}
              createdAt={catalog.createdAt}
              createdBy={catalog.createdBy}
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

          {templates && templates.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Começar de um padrão</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateId(null)}
                  className={cn(
                    "flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-md border-2 bg-muted/40 p-2 text-xs text-muted-foreground transition-colors hover:bg-muted",
                    templateId === null
                      ? "border-primary"
                      : "border-transparent",
                  )}
                >
                  <Plus className="h-5 w-5" />
                  Em branco
                </button>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      "flex aspect-[3/4] flex-col overflow-hidden rounded-md border-2 transition-colors",
                      templateId === t.id
                        ? "border-primary"
                        : "border-transparent hover:border-muted-foreground/30",
                    )}
                  >
                    <div className="flex-1 overflow-hidden bg-muted">
                      {t.thumbnail ? (
                        // biome-ignore lint/performance/noImgElement: miniatura local do padrão
                        <img
                          src={t.thumbnail}
                          alt={t.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="truncate px-1 py-0.5 text-[11px]">
                      {t.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
