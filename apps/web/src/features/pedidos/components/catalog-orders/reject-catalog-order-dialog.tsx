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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useRejectCatalogOrder } from "../../hooks/use-catalog-orders";

const rejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Informe o motivo da recusa")
    .max(500, "Motivo muito longo"),
});

type RejectForm = z.infer<typeof rejectSchema>;

interface RejectCatalogOrderDialogProps {
  saleId: string;
  saleNumber: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RejectCatalogOrderDialog({
  saleId,
  saleNumber,
  open,
  onOpenChange,
}: RejectCatalogOrderDialogProps) {
  const reject = useRejectCatalogOrder();
  const form = useForm<RejectForm>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: "" },
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  }

  function onSubmit(values: RejectForm) {
    reject.mutate(
      { saleId, reason: values.reason },
      { onSuccess: () => handleOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Recusar pedido #{saleNumber}</DialogTitle>
            <DialogDescription>
              O pedido vai para Cancelados com o motivo registrado. Nada foi
              cobrado nem saiu do estoque.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Controller
              name="reason"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Motivo</FieldLabel>
                  <Textarea
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    placeholder="Ex.: produto sem estoque, fora da área de entrega..."
                    disabled={reject.isPending}
                  />
                  {fieldState.error && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={reject.isPending}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={reject.isPending}
            >
              {reject.isPending ? <Spinner /> : "Recusar pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
