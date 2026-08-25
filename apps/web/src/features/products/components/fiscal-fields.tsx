"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText } from "lucide-react";
import { Controller, type Control, type FieldValues } from "react-hook-form";

// Cadastro tributário do produto — usado tanto no create quanto no edit form.
// Todos os campos são opcionais aqui; a Fase B (emissão) que valida
// "obrigatório pra emitir NFCe". Referências úteis pro operador:
//   NCM  → https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias
//   CFOP → tabela em https://www.confaz.fazenda.gov.br
//   CST  → varia por regime (Simples usa CSOSN de 101 a 900)

const ORIGENS = [
  { value: "0", label: "0 — Nacional" },
  { value: "1", label: "1 — Estrangeira: Importação direta" },
  { value: "2", label: "2 — Estrangeira: Mercado interno" },
  { value: "3", label: "3 — Nacional c/ conteúdo estrangeiro > 40%" },
  { value: "4", label: "4 — Nacional: processos básicos" },
  { value: "5", label: "5 — Nacional c/ conteúdo estrangeiro ≤ 40%" },
  { value: "6", label: "6 — Estrangeira: sem similar nacional" },
  { value: "7", label: "7 — Estrangeira: mercado interno s/ similar" },
  { value: "8", label: "8 — Nacional c/ conteúdo estrangeiro > 70%" },
];

interface FiscalFieldsProps<TForm extends FieldValues> {
  // Genérico: aceita tanto o `ProductType` (create) quanto o schema local do
  // edit-form. Os `name`s dos Controller são checados em runtime.
  control: Control<TForm>;
}

export function FiscalFields<TForm extends FieldValues>({
  control,
}: FiscalFieldsProps<TForm>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = control as Control<any>;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5" />
          Cadastro fiscal
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Controller
          control={c}
          name="ncm"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="ncm">NCM</FieldLabel>
              <Input
                id="ncm"
                placeholder="Ex.: 22021000"
                value={field.value ?? ""}
                onChange={field.onChange}
                maxLength={10}
              />
              <FieldDescription>
                8 dígitos. Classificação do produto na Receita.
              </FieldDescription>
            </Field>
          )}
        />

        <Controller
          control={c}
          name="cest"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="cest">CEST</FieldLabel>
              <Input
                id="cest"
                placeholder="Ex.: 0100100"
                value={field.value ?? ""}
                onChange={field.onChange}
                maxLength={7}
              />
              <FieldDescription>
                Só produtos com Substituição Tributária.
              </FieldDescription>
            </Field>
          )}
        />

        <Controller
          control={c}
          name="cfop"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="cfop">CFOP</FieldLabel>
              <Input
                id="cfop"
                placeholder="Ex.: 5102"
                value={field.value ?? ""}
                onChange={field.onChange}
                maxLength={4}
              />
              <FieldDescription>
                5xxx dentro do estado, 6xxx entre estados.
              </FieldDescription>
            </Field>
          )}
        />

        <Controller
          control={c}
          name="origem"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="origem">Origem da mercadoria</FieldLabel>
              <Select value={field.value ?? "0"} onValueChange={field.onChange}>
                <SelectTrigger id="origem">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        <Controller
          control={c}
          name="cstIcms"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="cstIcms">CST/CSOSN ICMS</FieldLabel>
              <Input
                id="cstIcms"
                placeholder="Ex.: 00 ou 102 (Simples)"
                value={field.value ?? ""}
                onChange={field.onChange}
                maxLength={4}
              />
              <FieldDescription>
                Simples usa CSOSN (101–900). Presumido/Real usa CST (00–90).
              </FieldDescription>
            </Field>
          )}
        />

        <Controller
          control={c}
          name="aliqIcms"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="aliqIcms">Alíquota ICMS (%)</FieldLabel>
              <Input
                id="aliqIcms"
                type="number"
                step="0.01"
                min={0}
                max={100}
                placeholder="Ex.: 18"
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
            </Field>
          )}
        />

        <Controller
          control={c}
          name="cstPis"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="cstPis">CST PIS</FieldLabel>
              <Input
                id="cstPis"
                placeholder="Ex.: 01 ou 49"
                value={field.value ?? ""}
                onChange={field.onChange}
                maxLength={2}
              />
            </Field>
          )}
        />

        <Controller
          control={c}
          name="aliqPis"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="aliqPis">Alíquota PIS (%)</FieldLabel>
              <Input
                id="aliqPis"
                type="number"
                step="0.01"
                min={0}
                max={100}
                placeholder="Ex.: 1.65"
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
            </Field>
          )}
        />

        <div />

        <Controller
          control={c}
          name="cstCofins"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="cstCofins">CST COFINS</FieldLabel>
              <Input
                id="cstCofins"
                placeholder="Ex.: 01 ou 49"
                value={field.value ?? ""}
                onChange={field.onChange}
                maxLength={2}
              />
            </Field>
          )}
        />

        <Controller
          control={c}
          name="aliqCofins"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="aliqCofins">Alíquota COFINS (%)</FieldLabel>
              <Input
                id="aliqCofins"
                type="number"
                step="0.01"
                min={0}
                max={100}
                placeholder="Ex.: 7.6"
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === "" ? undefined : Number(e.target.value),
                  )
                }
              />
            </Field>
          )}
        />

        <Controller
          control={c}
          name="cClassTrib"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="cClassTrib">
                cClassTrib (reforma IBS/CBS)
              </FieldLabel>
              <Input
                id="cClassTrib"
                placeholder="Preencher quando aplicável"
                value={field.value ?? ""}
                onChange={field.onChange}
                maxLength={10}
              />
              <FieldDescription>
                Novo código de classificação tributária da reforma.
              </FieldDescription>
            </Field>
          )}
        />
      </CardContent>
    </Card>
  );
}
