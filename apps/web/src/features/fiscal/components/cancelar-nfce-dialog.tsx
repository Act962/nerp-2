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
import { useCancelarNfce } from "../hooks/use-nfce";

const schema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(15, "A SEFAZ exige pelo menos 15 caracteres")
    .max(255, "No máximo 255 caracteres"),
});

type Valores = z.infer<typeof schema>;

export type NotaParaCancelar = {
  id: string;
  numero: number;
  serie: number;
  cancelavelAte: string | null;
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Fortaleza",
  });
}

export function CancelarNfceDialog({
  nota,
  onOpenChange,
}: {
  nota: NotaParaCancelar | null;
  onOpenChange: (open: boolean) => void;
}) {
  const cancelar = useCancelarNfce();
  const form = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: { justificativa: "" },
  });

  useEffect(() => {
    if (nota) form.reset({ justificativa: "" });
  }, [nota, form]);

  function onSubmit(valores: Valores) {
    if (!nota) return;
    cancelar.mutate(
      { documentoId: nota.id, justificativa: valores.justificativa },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={!!nota} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Cancelar NFC-e nº {nota?.numero} (série {nota?.serie})
          </DialogTitle>
          <DialogDescription>
            O cancelamento vai para a SEFAZ e não pode ser desfeito.
            {nota?.cancelavelAte &&
              ` O prazo legal termina às ${hora(nota.cancelavelAte)}.`}{" "}
            A venda continua registrada — o cancelamento é só da nota.
          </DialogDescription>
        </DialogHeader>
        <form
          id="cancelar-nfce"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <Controller
            control={form.control}
            name="justificativa"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="cancelar-justificativa">
                  Justificativa
                </FieldLabel>
                <Textarea
                  id="cancelar-justificativa"
                  rows={3}
                  placeholder="Ex.: cliente desistiu da compra no caixa"
                  aria-invalid={fieldState.invalid}
                  {...field}
                />
                <FieldDescription>
                  Vai para a SEFAZ junto com o pedido. Entre 15 e 255
                  caracteres.
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
            form="cancelar-nfce"
            variant="destructive"
            disabled={cancelar.isPending}
          >
            {cancelar.isPending ? "Cancelando…" : "Cancelar nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
