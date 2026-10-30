"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CFOPS_VAREJO,
  CSOSN,
  CST_ICMS,
  CST_PIS_COFINS,
  ORIGENS,
  usaCsosn,
  validarCamposFiscais,
} from "@nerp/fiscal";
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
import {
  useEditarFiscalEmLote,
  usePerfilTributario,
} from "../hooks/use-perfil-tributario";
import { CodigoFiscalSelect } from "./codigo-fiscal-select";

const CAMPOS = [
  "ncm",
  "cest",
  "cfop",
  "origem",
  "cstIcms",
  "cstPis",
  "cstCofins",
] as const;

type Valores = Record<(typeof CAMPOS)[number], string | null>;

const VAZIO: Valores = {
  ncm: null,
  cest: null,
  cfop: null,
  origem: null,
  cstIcms: null,
  cstPis: null,
  cstCofins: null,
};

interface EditarFiscalEmLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  onSalvo: () => void;
}

// Campo deixado em branco NÃO muda nos produtos — só o que for preenchido é
// aplicado. Para voltar um produto ao padrão da empresa, edite-o direto.
export function EditarFiscalEmLoteDialog({
  open,
  onOpenChange,
  productIds,
  onSalvo,
}: EditarFiscalEmLoteDialogProps) {
  const { data: perfil } = usePerfilTributario();
  const editar = useEditarFiscalEmLote();
  const regime = perfil?.regime ?? null;
  const simples = regime ? usaCsosn(regime) : true;

  const schema = z
    .object({
      ncm: z.string().nullable(),
      cest: z.string().nullable(),
      cfop: z.string().nullable(),
      origem: z.string().nullable(),
      cstIcms: z.string().nullable(),
      cstPis: z.string().nullable(),
      cstCofins: z.string().nullable(),
    })
    .superRefine((valores, ctx) => {
      if (!CAMPOS.some((c) => valores[c]))
        ctx.addIssue({
          code: "custom",
          path: ["ncm"],
          message: "Preencha pelo menos um campo",
        });
      for (const p of validarCamposFiscais(valores, regime))
        ctx.addIssue({ code: "custom", path: [p.campo], message: p.mensagem });
    });

  const form = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: VAZIO,
  });

  useEffect(() => {
    if (open) form.reset(VAZIO);
  }, [open, form]);

  function onSubmit(valores: Valores) {
    const patch = Object.fromEntries(
      CAMPOS.filter((c) => valores[c]).map((c) => [c, valores[c]]),
    );
    editar.mutate(
      { productIds, patch },
      {
        onSuccess: () => {
          onSalvo();
          onOpenChange(false);
        },
      },
    );
  }

  const selectField = (
    name: "cfop" | "origem" | "cstIcms" | "cstPis" | "cstCofins",
    label: string,
    tabela: Parameters<typeof CodigoFiscalSelect>[0]["tabela"],
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`lote-${name}`}>{label}</FieldLabel>
          <CodigoFiscalSelect
            id={`lote-${name}`}
            tabela={tabela}
            value={field.value}
            onChange={field.onChange}
            rotuloVazio="Não alterar"
          />
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );

  const textField = (name: "ncm" | "cest", label: string, dica: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`lote-${name}`}>{label}</FieldLabel>
          <Input
            id={`lote-${name}`}
            value={field.value ?? ""}
            onChange={(e) => field.onChange(e.target.value || null)}
            placeholder="Não alterar"
            aria-invalid={fieldState.invalid}
          />
          <FieldDescription>{dica}</FieldDescription>
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Editar fiscal de {productIds.length}{" "}
            {productIds.length === 1 ? "produto" : "produtos"}
          </DialogTitle>
          <DialogDescription>
            Só os campos preenchidos são aplicados. Os demais ficam como estão
            em cada produto.
          </DialogDescription>
        </DialogHeader>

        <form id="editar-fiscal-lote" onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {textField("ncm", "NCM", "8 dígitos, pontuação é ignorada")}
            {textField("cest", "CEST", "Só para produtos com ST")}
            {selectField("cfop", "CFOP", CFOPS_VAREJO)}
            {selectField("origem", "Origem", ORIGENS)}
            {selectField(
              "cstIcms",
              simples ? "CSOSN (ICMS no Simples)" : "CST do ICMS",
              simples ? CSOSN : CST_ICMS,
            )}
            {selectField("cstPis", "CST do PIS", CST_PIS_COFINS)}
            {selectField("cstCofins", "CST do COFINS", CST_PIS_COFINS)}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="editar-fiscal-lote"
            disabled={editar.isPending}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
