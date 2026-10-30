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
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useInutilizarNumeracao } from "../hooks/use-notas-fiscais";

const schema = z
  .object({
    numeroInicial: z.number().int().positive("Informe o número inicial"),
    numeroFinal: z.number().int().positive("Informe o número final"),
    justificativa: z
      .string()
      .trim()
      .min(15, "A SEFAZ exige pelo menos 15 caracteres")
      .max(255, "No máximo 255 caracteres"),
  })
  .refine((v) => v.numeroFinal >= v.numeroInicial, {
    path: ["numeroFinal"],
    message: "O final não pode ser menor que o inicial",
  });

type Valores = z.infer<typeof schema>;

export function InutilizarDialog({
  faixa,
  serie,
  onOpenChange,
}: {
  faixa: { inicio: number; fim: number } | null;
  serie: number;
  onOpenChange: (open: boolean) => void;
}) {
  const inutilizar = useInutilizarNumeracao();
  const form = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: { numeroInicial: 0, numeroFinal: 0, justificativa: "" },
  });

  useEffect(() => {
    if (faixa)
      form.reset({
        numeroInicial: faixa.inicio,
        numeroFinal: faixa.fim,
        justificativa: "",
      });
  }, [faixa, form]);

  function onSubmit(valores: Valores) {
    inutilizar.mutate(valores, { onSuccess: () => onOpenChange(false) });
  }

  const numero = (name: "numeroInicial" | "numeroFinal", label: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`inutilizar-${name}`}>{label}</FieldLabel>
          <Input
            id={`inutilizar-${name}`}
            type="number"
            inputMode="numeric"
            min={1}
            value={field.value || ""}
            onChange={(e) => field.onChange(Number(e.target.value))}
            aria-invalid={fieldState.invalid}
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );

  return (
    <Dialog open={!!faixa} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inutilizar números da série {serie}</DialogTitle>
          <DialogDescription>
            Avisa a SEFAZ que estes números não vão virar nota. Não tem volta:
            um número inutilizado nunca mais pode ser usado. Nota rejeitada
            dentro da faixa deixa de poder ser reenviada — a venda poderá emitir
            outra, com número novo.
          </DialogDescription>
        </DialogHeader>
        <form id="inutilizar-numeracao" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              {numero("numeroInicial", "Do número")}
              {numero("numeroFinal", "Até o número")}
            </div>
            <Controller
              control={form.control}
              name="justificativa"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="inutilizar-justificativa">
                    Justificativa
                  </FieldLabel>
                  <Textarea
                    id="inutilizar-justificativa"
                    rows={3}
                    placeholder="Ex.: números pulados por falha na transmissão"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  <FieldDescription>
                    Entre 15 e 255 caracteres.
                  </FieldDescription>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button
            type="submit"
            form="inutilizar-numeracao"
            variant="destructive"
            disabled={inutilizar.isPending}
          >
            {inutilizar.isPending ? "Enviando à SEFAZ…" : "Inutilizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
