"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useCancelarVenda } from "../hooks/use-sales";

const schema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(15, "Explique o motivo em pelo menos 15 caracteres")
    .max(255, "No máximo 255 caracteres"),
});

type Valores = z.infer<typeof schema>;

export type VendaParaCancelar = { id: string; saleNumber: number };

export function CancelSaleDialog({
  venda,
  onOpenChange,
}: {
  venda: VendaParaCancelar | null;
  onOpenChange: (open: boolean) => void;
}) {
  const cancelar = useCancelarVenda();
  const form = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: { justificativa: "" },
  });

  useEffect(() => {
    if (venda) form.reset({ justificativa: "" });
  }, [venda, form]);

  function onSubmit(valores: Valores) {
    if (!venda) return;
    cancelar.mutate(
      { saleId: venda.id, justificativa: valores.justificativa },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={!!venda} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar a venda #{venda?.saleNumber}</DialogTitle>
          <DialogDescription>
            Os produtos voltam para o estoque, o valor sai do caixa e do
            financeiro, e a NFC-e (se houver) é cancelada na SEFAZ. Não dá para
            desfazer. A nota só pode ser cancelada até 30 minutos depois de
            autorizada; depois disso, o caminho é a devolução.
          </DialogDescription>
        </DialogHeader>
        <form id="cancelar-venda" onSubmit={form.handleSubmit(onSubmit)}>
          <Controller
            control={form.control}
            name="justificativa"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cancelar-venda-justificativa">
                  Motivo do cancelamento
                </FieldLabel>
                <Textarea
                  id="cancelar-venda-justificativa"
                  rows={3}
                  placeholder="Ex.: cliente desistiu da compra no caixa"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                <FieldDescription>
                  Fica registrado na venda e vai para a SEFAZ junto com o
                  cancelamento da nota.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            type="submit"
            form="cancelar-venda"
            variant="destructive"
            disabled={cancelar.isPending}
          >
            {cancelar.isPending ? "Cancelando…" : "Cancelar venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
