"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { CatalogTable } from "./catalog-table";
import { MediaTypeDetailsDialog } from "./media-type-details-dialog";
import {
  useCreateMediaType,
  useCreateNegotiationType,
  useCreateStoreSector,
  useDeleteMediaType,
  useDeleteNegotiationType,
  useDeleteStoreSector,
  useEnsureTradeCatalogs,
  useMediaTypes,
  useNegotiationTypes,
  useStoreSectors,
  useUpdateMediaType,
  useUpdateNegotiationType,
  useUpdateStoreSector,
} from "../hooks/use-trade-catalog";

function MediaTab({ kind }: { kind: "FISICA" | "DIGITAL" }) {
  const { mediaTypes, isLoading } = useMediaTypes({
    kind,
    includeInactive: true,
  });
  const create = useCreateMediaType();
  const update = useUpdateMediaType();
  const remove = useDeleteMediaType();
  const [detailsId, setDetailsId] = useState<string | null>(null);

  return (
    <>
      <CatalogTable
        rows={mediaTypes}
        isLoading={isLoading}
        isCreating={create.isPending}
        onCreate={(code, name) => create.mutate({ kind, code, name })}
        onRename={(id, name) => update.mutate({ id, name })}
        onToggleActive={(id, isActive) => update.mutate({ id, isActive })}
        onDelete={(id) => remove.mutate({ id })}
        renderRowActions={(row) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title="Fotos, descrição e regras de ocupação"
            onClick={() => setDetailsId(row.id)}
          >
            <ImageIcon className="size-4" />
          </Button>
        )}
      />
      <MediaTypeDetailsDialog
        mediaTypeId={detailsId}
        onOpenChange={(open) => !open && setDetailsId(null)}
      />
    </>
  );
}

function NegotiationTab() {
  const { negotiationTypes, isLoading } = useNegotiationTypes({
    includeInactive: true,
  });
  const create = useCreateNegotiationType();
  const update = useUpdateNegotiationType();
  const remove = useDeleteNegotiationType();

  return (
    <CatalogTable
      rows={negotiationTypes}
      isLoading={isLoading}
      isCreating={create.isPending}
      onCreate={(code, name) => create.mutate({ code, name })}
      onRename={(id, name) => update.mutate({ id, name })}
      onToggleActive={(id, isActive) => update.mutate({ id, isActive })}
      onDelete={(id) => remove.mutate({ id })}
    />
  );
}

function SectorTab() {
  const { storeSectors, isLoading } = useStoreSectors({
    includeInactive: true,
  });
  const create = useCreateStoreSector();
  const update = useUpdateStoreSector();
  const remove = useDeleteStoreSector();

  return (
    <CatalogTable
      rows={storeSectors}
      isLoading={isLoading}
      isCreating={create.isPending}
      onCreate={(code, name) => create.mutate({ code, name })}
      onRename={(id, name) => update.mutate({ id, name })}
      onToggleActive={(id, isActive) => update.mutate({ id, isActive })}
      onDelete={(id) => remove.mutate({ id })}
    />
  );
}

export function TradeCatalogManager() {
  const ensure = useEnsureTradeCatalogs();

  return (
    <Tabs defaultValue="media-fisica">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="media-fisica">Mídia Física</TabsTrigger>
          <TabsTrigger value="media-digital">Mídia Digital</TabsTrigger>
          <TabsTrigger value="negociacao">Tipos de Negociação</TabsTrigger>
          <TabsTrigger value="setores">Setores</TabsTrigger>
        </TabsList>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => ensure.mutate({})}
          disabled={ensure.isPending}
          title="Cria os itens padrão de mídia, negociação e setores que ainda não existirem nesta organização"
        >
          {ensure.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Restaurar catálogos padrão
        </Button>
      </div>

      <TabsContent value="media-fisica" className="mt-4">
        <MediaTab kind="FISICA" />
      </TabsContent>
      <TabsContent value="media-digital" className="mt-4">
        <MediaTab kind="DIGITAL" />
      </TabsContent>
      <TabsContent value="negociacao" className="mt-4">
        <NegotiationTab />
      </TabsContent>
      <TabsContent value="setores" className="mt-4">
        <SectorTab />
      </TabsContent>
    </Tabs>
  );
}
