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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { formatBRL, useFecharCaixa } from "../hooks/use-caixa";

const schema = z.object({
  countedBalance: z.number().min(0, "Informe o valor contado"),
  closingNotes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

type Result = {
  expectedBalance: number;
  countedBalance: number;
  difference: number;
};

// Fechamento com CONTAGEM CEGA: o operador digita o que contou sem ver o
// esperado; o resultado (esperado × contado × diferença) só aparece depois.
export function CloseCaixaDialog() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const fechar = useFecharCaixa();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { countedBalance: 0, closingNotes: "" },
  });

  const onSubmit = async (values: FormValues) => {
    const data = await fechar.mutateAsync({
      countedBalance: values.countedBalance,
      closingNotes: values.closingNotes || undefined,
    });
    setResult(data);
  };

  const close = () => {
    setOpen(false);
    setResult(null);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">Fechar caixa</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Caixa fechado</DialogTitle>
              <DialogDescription>Conferência da gaveta.</DialogDescription>
            </DialogHeader>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Esperado</dt>
                <dd className="font-medium tabular-nums">
                  {formatBRL(result.expectedBalance)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Contado</dt>
                <dd className="font-medium tabular-nums">
                  {formatBRL(result.countedBalance)}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-2">
                <dt className="text-muted-foreground">Diferença</dt>
                <dd
                  className={cn(
                    "font-semibold tabular-nums",
                    result.difference === 0
                      ? "text-emerald-600"
                      : "text-destructive",
                  )}
                >
                  {formatBRL(result.difference)}
                </dd>
              </div>
            </dl>
            <DialogFooter className="mt-4">
              <Button onClick={close}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Fechar caixa</DialogTitle>
              <DialogDescription>
                Conte o dinheiro da gaveta e informe o total. O valor esperado
                só aparece depois de confirmar.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="countedBalance">
                    Valor contado na gaveta
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="countedBalance"
                    render={({ field }) => (
                      <Input
                        id="countedBalance"
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value),
                          )
                        }
                      />
                    )}
                  />
                  {errors.countedBalance && (
                    <FieldError>{errors.countedBalance.message}</FieldError>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="closingNotes">Observações</FieldLabel>
                  <Controller
                    control={control}
                    name="closingNotes"
                    render={({ field }) => (
                      <Input
                        id="closingNotes"
                        placeholder="Opcional"
                        {...field}
                      />
                    )}
                  />
                </Field>
              </FieldGroup>
              <DialogFooter className="mt-4">
                <Button type="submit" disabled={fechar.isPending}>
                  {fechar.isPending ? "Fechando…" : "Confirmar fechamento"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
