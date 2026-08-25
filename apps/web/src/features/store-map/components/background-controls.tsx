"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { uploadToR2 } from "@/lib/upload-to-r2";
import { ImageIcon, Ruler, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useSceneStore } from "../engine/scene-store";
import { useUpdateFloorPlan } from "../hooks/use-floor-plans";

interface BackgroundControlsProps {
  floorPlanId: string;
}

function measureNaturalWidth(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image.naturalWidth || 1000);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem"));
    };
    image.src = url;
  });
}

export function BackgroundControls({ floorPlanId }: BackgroundControlsProps) {
  const floorPlan = useSceneStore((state) => state.floorPlan);
  const patchFloorPlan = useSceneStore((state) => state.patchFloorPlan);
  const beginCalibration = useSceneStore((state) => state.beginCalibration);
  const updateFloorPlan = useUpdateFloorPlan();

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  if (!floorPlan) return null;

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const naturalWidth = await measureNaturalWidth(file);
      const key = await uploadToR2(file);
      const backgroundTransform = {
        x: 0,
        y: 0,
        scale: floorPlan.widthM / naturalWidth,
        rotation: 0,
      };
      patchFloorPlan({
        backgroundImageKey: key,
        backgroundOpacity: 1,
        backgroundTransform,
      });
      updateFloorPlan.mutate({
        id: floorPlanId,
        backgroundImageKey: key,
        backgroundOpacity: 1,
        backgroundTransform,
      });
      toast.success("Planta importada. Calibre a escala para medidas reais.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao importar planta",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleOpacity = (value: number) => {
    patchFloorPlan({ backgroundOpacity: value });
  };

  const commitOpacity = (value: number) => {
    updateFloorPlan.mutate({ id: floorPlanId, backgroundOpacity: value });
  };

  const handleRemove = () => {
    patchFloorPlan({ backgroundImageKey: null });
    updateFloorPlan.mutate({ id: floorPlanId, backgroundImageKey: null });
  };

  const hasBackground = !!floorPlan.backgroundImageKey;

  const startCalibration = () => {
    setOpen(false);
    beginCalibration();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="shadow">
          <ImageIcon className="size-4" />
          Planta
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-4">
        <div>
          <h4 className="text-sm font-semibold">Planta baixa</h4>
          <p className="text-xs text-muted-foreground">
            Importe uma imagem da planta e calibre a escala.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFile(file);
            event.target.value = "";
          }}
        />

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Spinner /> : <Upload className="size-4" />}
          {hasBackground ? "Trocar imagem" : "Importar imagem"}
        </Button>

        {hasBackground && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>Opacidade</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(floorPlan.backgroundOpacity * 100)}%
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[floorPlan.backgroundOpacity]}
                onValueChange={([value]) => handleOpacity(value)}
                onValueCommit={([value]) => commitOpacity(value)}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={startCalibration}
            >
              <Ruler className="size-4" />
              Calibrar escala
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-destructive"
              onClick={handleRemove}
            >
              <Trash2 className="size-4" />
              Remover planta
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
