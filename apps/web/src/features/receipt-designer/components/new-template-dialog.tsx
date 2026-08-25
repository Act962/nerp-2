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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useCreateReceiptTemplate } from "../hooks/use-receipt-templates";
import { presetBlocks } from "../lib/presets";
import type { ReceiptBlock, ReceiptPaper, ReceiptType } from "../lib/types";
import { RECEIPT_TYPE_LABELS } from "./template-list";

const TYPE_OPTIONS: ReceiptType[] = ["NAO_FISCAL", "FISCAL", "ORCAMENTO"];

const DEFAULT_PAPER: Record<ReceiptType, ReceiptPaper> = {
  NAO_FISCAL: "MM80",
  FISCAL: "MM80",
  ORCAMENTO: "A4",
};

export function NewTemplateDialog({
  onCreated,
}: {
  onCreated?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ReceiptType>("NAO_FISCAL");
  const create = useCreateReceiptTemplate();

  const handleSubmit = () => {
    if (!name.trim()) return;
    const blocks: ReceiptBlock[] = presetBlocks(type);
    create.mutate(
      {
        name: name.trim(),
        type,
        paper: DEFAULT_PAPER[type],
        blocks,
      },
      {
        onSuccess: ({ id }) => {
          setOpen(false);
          setName("");
          setType("NAO_FISCAL");
          onCreated?.(id);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Novo template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo template de cupom</DialogTitle>
          <DialogDescription>
            Escolha um tipo — os blocos iniciais vêm de um preset e podem ser
            ajustados depois.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Nome</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Cupom padrão"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as ReceiptType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RECEIPT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || create.isPending}
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
