"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSupplier } from "@/features/supplier/hooks/use-supplier";
import { useEffect, useState } from "react";
import { useSetMemberSupplierLinks } from "../hooks/use-members";

/**
 * Indústrias pelas quais o membro responde.
 *
 * Grava no mesmo vínculo `PromoterSupplier` que o promotor usa: é a mesma
 * pergunta, e uma segunda tabela faria esta tela e a de vínculos do promotor
 * discordarem sobre quem cuida de qual marca.
 */
export function MemberIndustriesDialog({
  memberId,
  memberName,
  currentSupplierIds,
  open,
  onOpenChange,
}: {
  memberId: string;
  memberName: string;
  currentSupplierIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 400);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentSupplierIds),
  );
  const { suppliers, isLoading } = useSupplier({
    search: debounced || undefined,
    page: 1,
    pageSize: 100,
  });
  const save = useSetMemberSupplierLinks();

  // Reabrir precisa refletir o que foi salvo, não a seleção da vez anterior.
  useEffect(() => {
    if (open) setSelected(new Set(currentSupplierIds));
  }, [open, currentSupplierIds]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Indústrias de {memberName}</DialogTitle>
          <DialogDescription>
            Marcas pelas quais este membro responde. Usado no App Promotor e nos
            books.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar indústria…"
        />

        <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : suppliers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma indústria encontrada.
            </p>
          ) : (
            suppliers.map((supplier) => {
              const id = `member-supplier-${supplier.id}`;
              const checked = selected.has(supplier.id);
              return (
                <label
                  key={supplier.id}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-2 text-sm hover:bg-accent"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => toggle(supplier.id)}
                  />
                  <span className="truncate">{supplier.name}</span>
                </label>
              );
            })
          )}
        </div>

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
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { memberId, supplierIds: [...selected] },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {save.isPending && <Spinner />}
            Salvar {selected.size > 0 && `(${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
