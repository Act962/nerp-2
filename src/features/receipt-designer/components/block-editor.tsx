"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import type { ReceiptBlock } from "../lib/types";
import { AddBlockMenu } from "./add-block-menu";
import { BLOCK_LABELS, BlockFields } from "./block-fields";

export function BlockEditor({
  blocks,
  onChangeBlock,
  onMove,
  onRemove,
  onAdd,
}: {
  blocks: ReceiptBlock[];
  onChangeBlock: (id: string, patch: Partial<ReceiptBlock>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAdd: (kind: ReceiptBlock["kind"]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.length === 0 && (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Sem blocos. Adicione o primeiro abaixo.
        </p>
      )}
      {blocks.map((block, index) => (
        <Card key={block.id} className="gap-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GripVertical className="size-4 text-muted-foreground" />
              {BLOCK_LABELS[block.kind]}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
                aria-label="Mover para cima"
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={index === blocks.length - 1}
                onClick={() => onMove(index, 1)}
                aria-label="Mover para baixo"
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                onClick={() => onRemove(block.id)}
                aria-label="Remover bloco"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <BlockFields
            block={block}
            onChange={(patch) => onChangeBlock(block.id, patch)}
          />
        </Card>
      ))}
      <AddBlockMenu onAdd={onAdd} />
    </div>
  );
}
