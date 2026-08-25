"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { generateAisleBlock } from "../engine/auto-layout";
import {
  MAP_FIXTURE_MODELS,
  MAP_FIXTURE_MODELS_BY_ID,
} from "../engine/fixture-catalog";
import { fixtureLayerId } from "../engine/layer-utils";
import { useSceneStore } from "../engine/scene-store";

const MAX_ROWS = 40;
const MAX_PER_ROW = 60;

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * Gera um bloco de gôndolas em fileiras de uma vez — o atalho que substitui o
 * "inserir uma a uma". Todo o cálculo vive em `generateAisleBlock` (puro); aqui
 * só coletamos os parâmetros e criamos os objetos (o autosave persiste).
 */
export function GenerateLayoutDialog() {
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState(MAP_FIXTURE_MODELS[0]?.id ?? "");
  const [rows, setRows] = useState(4);
  const [perRow, setPerRow] = useState(6);
  const [aisle, setAisle] = useState(1.8);

  const addObject = useSceneStore((state) => state.addObject);
  const layers = useSceneStore((state) => state.layers);
  const activeLayerId = useSceneStore((state) => state.activeLayerId);
  const floorPlan = useSceneStore((state) => state.floorPlan);
  const setSelection = useSceneStore((state) => state.setSelection);
  const fitToPlan = useSceneStore((state) => state.fitToPlan);

  const model = MAP_FIXTURE_MODELS_BY_ID.get(modelId);

  const generate = () => {
    const layerId = fixtureLayerId(layers, activeLayerId);
    if (!model || !layerId || !floorPlan) return;

    const objects = generateAisleBlock({
      model,
      layerId,
      rows,
      perRow,
      aisleM: aisle,
      // Margem de 1 m do canto superior-esquerdo — posição previsível; o admin
      // reposiciona/seleciona o bloco depois.
      originX: 1,
      originY: 1,
      planWidthM: floorPlan.widthM,
      planHeightM: floorPlan.heightM,
      mediaTypeId: null,
    });

    if (objects.length === 0) {
      toast.error(
        "Nada coube no mapa. Reduza fileiras/gôndolas ou aumente o tamanho do mapa.",
      );
      return;
    }

    const ids = objects.map((object) => addObject(object));
    setSelection(ids);
    fitToPlan();
    toast.success(`${objects.length} gôndolas geradas`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Gerar corredor de gôndolas"
          aria-label="Gerar corredor de gôndolas"
        >
          <LayoutGrid className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar corredor de gôndolas</DialogTitle>
          <DialogDescription>
            Posiciona várias gôndolas em fileiras de uma vez. Você ajusta
            depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel>Modelo de gôndola</FieldLabel>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                {MAP_FIXTURE_MODELS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="gen-rows">Nº de fileiras</FieldLabel>
              <Input
                id="gen-rows"
                type="number"
                min={1}
                max={MAX_ROWS}
                value={rows}
                onChange={(event) =>
                  setRows(clampInt(event.target.valueAsNumber, 1, MAX_ROWS))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="gen-per-row">
                Gôndolas por fileira
              </FieldLabel>
              <Input
                id="gen-per-row"
                type="number"
                min={1}
                max={MAX_PER_ROW}
                value={perRow}
                onChange={(event) =>
                  setPerRow(
                    clampInt(event.target.valueAsNumber, 1, MAX_PER_ROW),
                  )
                }
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="gen-aisle">
              Corredor entre fileiras (m)
            </FieldLabel>
            <Input
              id="gen-aisle"
              type="number"
              min={0}
              step="0.1"
              value={aisle}
              onChange={(event) =>
                setAisle(
                  Number.isFinite(event.target.valueAsNumber)
                    ? Math.max(0, event.target.valueAsNumber)
                    : 0,
                )
              }
            />
          </Field>

          {model && floorPlan && (
            <p className="text-xs text-muted-foreground">
              Cada gôndola ocupa {model.widthM.toFixed(2)} ×{" "}
              {model.depthM.toFixed(2)} m. Mapa: {floorPlan.widthM} ×{" "}
              {floorPlan.heightM} m. O que passar das bordas é descartado.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={generate} disabled={!model}>
            Gerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
