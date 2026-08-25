"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sofa } from "lucide-react";
import { useState } from "react";
import {
  MAP_FIXTURE_MODELS,
  MAP_FIXTURE_MODELS_BY_ID,
} from "../engine/fixture-catalog";
import { useSceneStore } from "../engine/scene-store";

const MAX_DIVISIONS = 12;
const MAX_LANES = 4;

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

/**
 * Paleta de mobiliário: escolhe o modelo + a grade (divisões × faces) e arma a
 * colocação. O próximo clique no mapa solta as N×M células reais (cada uma uma
 * gôndola clicável). Ver `map-stage` handleDown.
 */
export function FixturePalette() {
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState(MAP_FIXTURE_MODELS[0]?.id ?? "");
  const [divisions, setDivisions] = useState(
    MAP_FIXTURE_MODELS[0]?.shelfCount ?? 1,
  );
  const [lanes, setLanes] = useState(MAP_FIXTURE_MODELS[0]?.lanes ?? 1);

  const setPendingFixture = useSceneStore((state) => state.setPendingFixture);
  const pending = useSceneStore((state) => state.pendingFixture);

  const selectModel = (id: string) => {
    const model = MAP_FIXTURE_MODELS_BY_ID.get(id);
    setModelId(id);
    if (model) {
      setDivisions(model.shelfCount);
      setLanes(model.lanes);
    }
  };

  const arm = () => {
    if (!modelId) return;
    setPendingFixture({ modelId, divisions, lanes });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={pending ? "default" : "ghost"}
          size="icon"
          title="Mobiliário"
          aria-label="Mobiliário"
        >
          <Sofa className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <p className="text-xs text-muted-foreground">
          Escolha o móvel e a grade; depois clique no mapa para posicionar. Cada
          célula vira uma gôndola clicável.
        </p>
        <div className="grid gap-1">
          {MAP_FIXTURE_MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => selectModel(model.id)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                modelId === model.id ? "border-primary bg-accent" : ""
              }`}
            >
              <span className="font-medium">{model.label}</span>
              <span className="text-xs text-muted-foreground">
                {model.widthM.toFixed(2)}×{model.depthM.toFixed(2)} m
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="palette-divisions">Divisões</FieldLabel>
            <Input
              id="palette-divisions"
              type="number"
              min={1}
              max={MAX_DIVISIONS}
              value={divisions}
              onChange={(event) =>
                setDivisions(
                  clampInt(event.target.valueAsNumber, 1, MAX_DIVISIONS),
                )
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="palette-lanes">Faces</FieldLabel>
            <Input
              id="palette-lanes"
              type="number"
              min={1}
              max={MAX_LANES}
              value={lanes}
              onChange={(event) =>
                setLanes(clampInt(event.target.valueAsNumber, 1, MAX_LANES))
              }
            />
          </Field>
        </div>

        <p className="text-xs text-muted-foreground">
          {divisions * lanes} gôndolas serão criadas.
        </p>

        <Button
          type="button"
          className="w-full"
          onClick={arm}
          disabled={!modelId}
        >
          Posicionar no mapa
        </Button>
      </PopoverContent>
    </Popover>
  );
}
