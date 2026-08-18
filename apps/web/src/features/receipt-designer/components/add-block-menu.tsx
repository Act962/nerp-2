"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import type { ReceiptBlockKind } from "../lib/types";
import { BLOCK_LABELS } from "./block-fields";

const BLOCK_KINDS: ReceiptBlockKind[] = [
  "logo",
  "header",
  "text",
  "items",
  "totals",
  "qr",
  "link",
  "divider",
  "spacer",
];

export function AddBlockMenu({
  onAdd,
}: {
  onAdd: (kind: ReceiptBlockKind) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <Plus className="size-4" />
          Adicionar bloco
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {BLOCK_KINDS.map((kind) => (
          <DropdownMenuItem key={kind} onSelect={() => onAdd(kind)}>
            {BLOCK_LABELS[kind]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
