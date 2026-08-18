"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Spinner } from "@/components/ui/spinner";
import { useSaveBookTemplate } from "../../hooks/use-books";
import {
  EDITOR_FIELD_CLASS,
  EDITOR_SELECT_CLASS,
} from "../cover-editor/editor-controls";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  supplierId: string | null;
  supplierName: string | null;
}

type Scope = "supplier" | "organization";

export function SaveTemplateDialog({
  open,
  onOpenChange,
  bookId,
  supplierId,
  supplierName,
}: SaveTemplateDialogProps) {
  const saveTemplate = useSaveBookTemplate();
  const [name, setName] = useState("");
  // Book com indústria salva pra indústria por padrão: é o caso que a reunião
  // pediu, cada fornecedor com o próprio visual.
  const [scope, setScope] = useState<Scope>(
    supplierId ? "supplier" : "organization",
  );

  useEffect(() => {
    if (open) {
      setName(
        supplierName ? `Padrão ${supplierName}` : "Padrão da organização",
      );
      setScope(supplierId ? "supplier" : "organization");
    }
  }, [open, supplierId, supplierName]);

  const submit = () => {
    saveTemplate.mutate(
      {
        bookId,
        name: name.trim(),
        supplierId: scope === "supplier" ? supplierId : null,
        isDefault: true,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar como padrão</DialogTitle>
          <DialogDescription>
            Guarda a capa, a página final e o layout das páginas deste book pra
            reaplicar em outros. É uma cópia: editar o padrão depois não altera
            books já montados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Nome do padrão</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={EDITOR_FIELD_CLASS}
              placeholder="Ex.: Padrão Coca-Cola 2026"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Vale para</Label>
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as Scope)}
            >
              <SelectTrigger className={`w-full ${EDITOR_SELECT_CLASS}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supplierId && (
                  <SelectItem value="supplier">
                    Apenas {supplierName ?? "esta indústria"}
                  </SelectItem>
                )}
                <SelectItem value="organization">Toda a organização</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {scope === "supplier"
                ? "Só os books desta indústria carregam este padrão."
                : "Usado nos books sem indústria e como base copiada quando uma indústria ainda não tem padrão próprio."}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!name.trim() || saveTemplate.isPending}
          >
            {saveTemplate.isPending && <Spinner />}
            Salvar padrão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
