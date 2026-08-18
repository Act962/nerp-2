"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useStore } from "@/features/stores/hooks/use-stores";
import { ArrowLeft, Map as MapIcon, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDeleteFloorPlan, useFloorPlans } from "../hooks/use-floor-plans";
import { MapEditor } from "./map-editor";
import { NewFloorPlanDialog } from "./new-floor-plan-dialog";

interface StoreMapWorkspaceProps {
  storeId: string;
}

export function StoreMapWorkspace({ storeId }: StoreMapWorkspaceProps) {
  const { store } = useStore(storeId);
  const { floorPlans, isLoading } = useFloorPlans(storeId);
  const deleteFloorPlan = useDeleteFloorPlan();

  const [selectedId, setSelectedId] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    if (floorPlans.length === 0) {
      setSelectedId("");
      return;
    }
    const stillExists = floorPlans.some((plan) => plan.id === selectedId);
    if (!stillExists) setSelectedId(floorPlans[0].id);
  }, [floorPlans, selectedId]);

  const handleDelete = () => {
    if (!selectedId) return;
    deleteFloorPlan.mutate({ id: selectedId });
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[520px] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/lojas" aria-label="Voltar para lojas">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold">
              {store?.name ?? "Mapa da loja"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Desenhe a planta e posicione os PDVs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {floorPlans.length > 0 && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecione o mapa" />
              </SelectTrigger>
              <SelectContent>
                {floorPlans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="size-4" />
            Novo mapa
          </Button>
          {selectedId && (
            <Button
              variant="outline"
              size="icon"
              title="Excluir mapa"
              onClick={handleDelete}
              disabled={deleteFloorPlan.isPending}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : selectedId ? (
          <MapEditor key={selectedId} floorPlanId={selectedId} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
            <MapIcon className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Esta loja ainda não tem nenhum mapa.
            </p>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="size-4" />
              Criar primeiro mapa
            </Button>
          </div>
        )}
      </div>

      <NewFloorPlanDialog
        storeId={storeId}
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={setSelectedId}
      />
    </div>
  );
}
