"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { useCreateFloorPlan } from "../hooks/use-floor-plans";

interface NewFloorPlanDialogProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function NewFloorPlanDialog({
  storeId,
  open,
  onOpenChange,
  onCreated,
}: NewFloorPlanDialogProps) {
  const createFloorPlan = useCreateFloorPlan();
  const [name, setName] = useState("");
  const [widthM, setWidthM] = useState("50");
  const [heightM, setHeightM] = useState("50");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const result = await createFloorPlan.mutateAsync({
      storeId,
      name: name.trim(),
      widthM: Number(widthM) || 50,
      heightM: Number(heightM) || 50,
    });
    setName("");
    onOpenChange(false);
    onCreated(result.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo mapa</DialogTitle>
          <DialogDescription>
            Defina o nome e as dimensões reais da área (em metros).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="plan-name">Nome do mapa</FieldLabel>
            <Input
              id="plan-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Térreo"
            />
          </Field>
          <div className="flex gap-4">
            <Field>
              <FieldLabel htmlFor="plan-width">Largura (m)</FieldLabel>
              <Input
                id="plan-width"
                type="number"
                value={widthM}
                onChange={(event) => setWidthM(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-height">Comprimento (m)</FieldLabel>
              <Input
                id="plan-height"
                type="number"
                value={heightM}
                onChange={(event) => setHeightM(event.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={createFloorPlan.isPending || !name.trim()}
          >
            {createFloorPlan.isPending && <Spinner />}
            Criar mapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
