"use client";

import {
  Circle,
  Shapes,
  Square,
  SquareRoundCorner,
  Triangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CoverShapeKind } from "../../lib/cover-layout";
import { EDITOR_BUTTON_CLASS } from "./editor-controls";

const SHAPES: Array<{
  kind: CoverShapeKind;
  label: string;
  icon: typeof Square;
}> = [
  { kind: "rect", label: "Retângulo", icon: Square },
  { kind: "rounded", label: "Arredondado", icon: SquareRoundCorner },
  { kind: "circle", label: "Círculo", icon: Circle },
  { kind: "triangle", label: "Triângulo", icon: Triangle },
];

export function ShapeMenu({
  onAdd,
}: {
  onAdd: (kind: CoverShapeKind) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`gap-2 ${EDITOR_BUTTON_CLASS}`}
        >
          <Shapes className="size-4" /> Formas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {SHAPES.map((shape) => (
          <DropdownMenuItem
            key={shape.kind}
            className="gap-2 py-2.5"
            onSelect={() => onAdd(shape.kind)}
          >
            <shape.icon className="size-4" />
            {shape.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
