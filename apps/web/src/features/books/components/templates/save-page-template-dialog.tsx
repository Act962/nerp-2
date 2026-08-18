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
import {
  useBookPageTemplates,
  useSaveBookPageTemplate,
} from "../../hooks/use-books";
import {
  EDITOR_FIELD_CLASS,
  EDITOR_SELECT_CLASS,
} from "../cover-editor/editor-controls";

// Sentinela: o Select do Radix não aceita "" como value de item.
const NOVO_PADRAO = "__novo__";

interface SavePageTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  // Sem itemId salva o layout do book (aba Personalizado); com, salva o layout
  // próprio daquela página.
  itemId?: string | null;
  supplierId: string | null;
  supplierName: string | null;
}

type Scope = "supplier" | "organization";

export function SavePageTemplateDialog({
  open,
  onOpenChange,
  bookId,
  itemId,
  supplierId,
  supplierName,
}: SavePageTemplateDialogProps) {
  const savePageTemplate = useSaveBookPageTemplate();
  const { templates } = useBookPageTemplates(supplierId);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Scope>(
    supplierId ? "supplier" : "organization",
  );
  // NOVO_PADRAO cria; qualquer outro id sobrescreve aquele padrão, levando as
  // mexidas do Personalizado para ele.
  const [alvo, setAlvo] = useState<string>(NOVO_PADRAO);

  useEffect(() => {
    if (open) {
      setName("");
      setScope(supplierId ? "supplier" : "organization");
      setAlvo(NOVO_PADRAO);
    }
  }, [open, supplierId]);

  // Sobrescrever = salvar com o mesmo nome e escopo do padrão escolhido; o
  // servidor faz upsert por (organização, indústria, nome).
  const escolherAlvo = (id: string) => {
    setAlvo(id);
    if (id === NOVO_PADRAO) {
      setName("");
      return;
    }
    const existente = templates.find((template) => template.id === id);
    if (!existente) return;
    setName(existente.name);
    setScope(existente.supplierId ? "supplier" : "organization");
  };

  const sobrescrevendo = alvo !== NOVO_PADRAO;

  const submit = () => {
    savePageTemplate.mutate(
      {
        bookId,
        itemId: itemId ?? null,
        name: name.trim(),
        supplierId: scope === "supplier" ? supplierId : null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {sobrescrevendo
              ? "Atualizar padrão de página"
              : "Salvar como padrão de página"}
          </DialogTitle>
          <DialogDescription>
            {sobrescrevendo
              ? "As mexidas deste layout vão para o padrão escolhido. Páginas já montadas com ele não mudam — só os próximos usos."
              : "Guarda este layout de página para reaplicar ao adicionar páginas novas."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">O que fazer</Label>
            <Select value={alvo} onValueChange={escolherAlvo}>
              <SelectTrigger className={`w-full ${EDITOR_SELECT_CLASS}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NOVO_PADRAO}>
                  Criar um padrão novo
                </SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    Atualizar “{template.name}”
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Nome do padrão</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={EDITOR_FIELD_CLASS}
              placeholder="Ex.: Abertura de seção, Comparativo, 1 foto grande"
              disabled={sobrescrevendo}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Vale para</Label>
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as Scope)}
              disabled={sobrescrevendo}
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!name.trim() || savePageTemplate.isPending}
          >
            {savePageTemplate.isPending && <Spinner />}
            {sobrescrevendo ? "Atualizar padrão" : "Salvar padrão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
