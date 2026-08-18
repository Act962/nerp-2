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
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCreateTradeCatalog } from "../hooks/use-trade-catalog-doc";

interface CreateCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCatalogDialog({
  open,
  onOpenChange,
}: CreateCatalogDialogProps) {
  const router = useRouter();
  const createCatalog = useCreateTradeCatalog();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
  }, [open]);

  const handleSubmit = () => {
    createCatalog.mutate(
      { name },
      {
        onSuccess: (result) => {
          onOpenChange(false);
          router.push(`/trade/catalogo-pdv/${result.id}`);
        },
      },
    );
  };

  const isValid = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo catálogo</DialogTitle>
          <DialogDescription>
            Crie um catálogo visual das oportunidades de PDV para enviar a
            fornecedores e indústrias.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="catalog-name">Nome do catálogo</FieldLabel>
          <Input
            id="catalog-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Oportunidades 2026"
          />
        </Field>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || createCatalog.isPending}
          >
            {createCatalog.isPending && <Spinner />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
