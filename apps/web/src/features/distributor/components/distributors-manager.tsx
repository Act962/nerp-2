"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Factory, Link2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useDeleteDistributor,
  useDistributors,
} from "../hooks/use-distributor";
import {
  type DistributorFormValues,
  DistributorFormDialog,
} from "./distributor-form-dialog";
import { DistributorRelationsDialog } from "./distributor-relations-dialog";

export function DistributorsManager() {
  const { data, isLoading } = useDistributors();
  const remove = useDeleteDistributor();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DistributorFormValues | null>(null);
  const [relationsFor, setRelationsFor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const distributors = data ?? [];

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(distributor: DistributorFormValues) {
    setEditing(distributor);
    setFormOpen(true);
  }
  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Excluir o distribuidor "${name}"?`)) return;
    remove.mutate(
      { id },
      {
        onSuccess: () => toast.success("Distribuidor excluído"),
        onError: (error) => toast.error(error.message),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={openNew}>
          <Plus className="size-4" /> Novo distribuidor
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : distributors.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          Nenhum distribuidor cadastrado. Crie um e vincule as indústrias que
          ele representa e as lojas que atende.
        </div>
      ) : (
        <div className="space-y-2">
          {distributors.map((distributor) => (
            <Card key={distributor.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{distributor.name}</span>
                    {!distributor.isActive && (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                    {distributor.document && (
                      <span>{distributor.document}</span>
                    )}
                    {distributor.contactName && (
                      <span>{distributor.contactName}</span>
                    )}
                    {distributor.contactPhone && (
                      <span>{distributor.contactPhone}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Factory className="size-3.5" />
                      {distributor.industryCount} indústrias
                    </span>
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {distributor.storeCount} lojas
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setRelationsFor({
                        id: distributor.id,
                        name: distributor.name,
                      })
                    }
                  >
                    <Link2 className="size-4" /> Vínculos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Editar"
                    onClick={() => openEdit(distributor)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir"
                    onClick={() =>
                      handleDelete(distributor.id, distributor.name)
                    }
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DistributorFormDialog
        distributor={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      {relationsFor && (
        <DistributorRelationsDialog
          distributorId={relationsFor.id}
          distributorName={relationsFor.name}
          open={Boolean(relationsFor)}
          onOpenChange={(open) => {
            if (!open) setRelationsFor(null);
          }}
        />
      )}
    </div>
  );
}
