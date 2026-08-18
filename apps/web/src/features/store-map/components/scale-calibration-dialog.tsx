"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { useSceneStore } from "../engine/scene-store";
import { useUpdateFloorPlan } from "../hooks/use-floor-plans";

interface ScaleCalibrationDialogProps {
  floorPlanId: string;
}

export function ScaleCalibrationDialog({
  floorPlanId,
}: ScaleCalibrationDialogProps) {
  const floorPlan = useSceneStore((state) => state.floorPlan);
  const calibrationPoints = useSceneStore((state) => state.calibrationPoints);
  const endCalibration = useSceneStore((state) => state.endCalibration);
  const patchFloorPlan = useSceneStore((state) => state.patchFloorPlan);
  const updateFloorPlan = useUpdateFloorPlan();

  const [meters, setMeters] = useState("");

  const open = calibrationPoints.length === 2;
  const [a, b] = calibrationPoints;
  const drawnLength = open ? Math.hypot(b.x - a.x, b.y - a.y) : 0;

  const handleConfirm = () => {
    const real = Number(meters);
    const transform = floorPlan?.backgroundTransform;
    if (!transform || drawnLength < 0.001 || !real || real <= 0) {
      toast.error("Informe uma medida válida em metros.");
      return;
    }
    const factor = real / drawnLength;
    const next = {
      x: transform.x * factor,
      y: transform.y * factor,
      scale: transform.scale * factor,
      rotation: transform.rotation,
    };
    patchFloorPlan({ backgroundTransform: next });
    updateFloorPlan.mutate({ id: floorPlanId, backgroundTransform: next });
    setMeters("");
    endCalibration();
    toast.success("Escala calibrada.");
  };

  const handleCancel = () => {
    setMeters("");
    endCalibration();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calibrar escala</DialogTitle>
          <DialogDescription>
            Qual é a medida real, em metros, entre os dois pontos marcados?
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="calibration-meters">
            Medida real (metros)
          </FieldLabel>
          <Input
            id="calibration-meters"
            type="number"
            min="0"
            step="0.1"
            value={meters}
            onChange={(event) => setMeters(event.target.value)}
            placeholder="Ex.: 5"
          />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
