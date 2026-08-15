"use client";

import {
  ImagePlay,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StandardPhotoOrientation } from "@/lib/photo-standard";
import { EDITOR_BUTTON_CLASS } from "./editor-controls";

const OPTIONS: Array<{
  orientation: StandardPhotoOrientation;
  label: string;
  icon: typeof RectangleVertical;
}> = [
  { orientation: "PORTRAIT", label: "Vertical (3:4)", icon: RectangleVertical },
  {
    orientation: "LANDSCAPE",
    label: "Horizontal (4:3)",
    icon: RectangleHorizontal,
  },
];

// Botão "Espaço de foto" com escolha de orientação: o slot nasce já na
// proporção padrão (3:4 ou 4:3) e só pode ser escalado proporcional.
export function PhotoSlotMenu({
  onAdd,
}: {
  onAdd: (orientation: StandardPhotoOrientation) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`gap-2 ${EDITOR_BUTTON_CLASS}`}
          title="Espaço que recebe a foto do PDV em cada página"
        >
          <ImagePlay className="size-4" /> Espaço de foto
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.orientation}
            className="gap-2 py-2.5"
            onSelect={() => onAdd(option.orientation)}
          >
            <option.icon className="size-4" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
