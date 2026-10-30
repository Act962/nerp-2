"use client";

import {
  CFOPS_VAREJO,
  CSOSN,
  CST_ICMS,
  CST_PIS_COFINS,
  type CampoFiscal,
  ORIGENS,
  usaCsosn,
  validarCamposFiscais,
} from "@nerp/fiscal";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CodigoFiscalSelect } from "@/features/fiscal/components/codigo-fiscal-select";
import { usePerfilTributario } from "@/features/fiscal/hooks/use-perfil-tributario";
import { FileText } from "lucide-react";
import { type Control, Controller, type FieldValues } from "react-hook-form";

// Cadastro tributário do produto — usado no create e no edit form.
//
// Campo vazio = usar o padrão da empresa (Integrações → Focus NFe). O NCM é a
// exceção: não tem padrão. O formato é conferido aqui enquanto digita, com a
// MESMA regra do servidor (`@nerp/fiscal`), e de novo ao salvar.

interface FiscalFieldsProps<TForm extends FieldValues> {
  // Genérico: aceita o `ProductType` (create) e o schema local do edit-form.
  // Os `name`s dos Controller são checados em runtime.
  control: Control<TForm>;
}

export function FiscalFields<TForm extends FieldValues>({
  control,
}: FiscalFieldsProps<TForm>) {
  const c = control as unknown as Control<
    Record<CampoFiscal | AliquotaCampo, string | number | undefined>
  >;
  const { data: perfil } = usePerfilTributario();
  const regime = perfil?.regime ?? null;
  const simples = regime ? usaCsosn(regime) : null;
  const padroes = perfil?.padroes;

  const erroDe = (campo: CampoFiscal, valor: unknown) =>
    typeof valor === "string"
      ? validarCamposFiscais({ [campo]: valor }, regime)[0]?.mensagem
      : undefined;

  const rotuloPadrao = (valor: string | null | undefined) =>
    valor ? `Usar padrão da empresa (${valor})` : "Não informado";

  const texto = (
    campo: "ncm" | "cest" | "cfop" | "cClassTrib" | "cstIbsCbs",
    label: string,
    props: { placeholder: string; descricao?: string; list?: string },
  ) => (
    <Controller
      control={c}
      name={campo}
      render={({ field }) => {
        const erro = erroDe(campo, field.value);
        return (
          <Field data-invalid={!!erro}>
            <FieldLabel htmlFor={campo}>{label}</FieldLabel>
            <Input
              id={campo}
              placeholder={props.placeholder}
              value={typeof field.value === "string" ? field.value : ""}
              onChange={field.onChange}
              list={props.list}
              aria-invalid={!!erro}
            />
            {erro ? (
              <FieldError>{erro}</FieldError>
            ) : (
              props.descricao && (
                <FieldDescription>{props.descricao}</FieldDescription>
              )
            )}
          </Field>
        );
      }}
    />
  );

  const select = (
    campo: "origem" | "cstIcms" | "cstPis" | "cstCofins",
    label: string,
    tabela: Parameters<typeof CodigoFiscalSelect>[0]["tabela"],
    rotuloVazio: string,
  ) => (
    <Controller
      control={c}
      name={campo}
      render={({ field }) => {
        const erro = erroDe(campo, field.value);
        return (
          <Field data-invalid={!!erro}>
            <FieldLabel htmlFor={campo}>{label}</FieldLabel>
            <CodigoFiscalSelect
              id={campo}
              tabela={tabela}
              value={typeof field.value === "string" ? field.value : null}
              // Os forms guardam string; "" é o vazio que o servidor
              // normaliza para null.
              onChange={(v) => field.onChange(v ?? "")}
              rotuloVazio={rotuloVazio}
            />
            {erro && <FieldError>{erro}</FieldError>}
          </Field>
        );
      }}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5" />
          Cadastro fiscal
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Campos em branco usam os{" "}
          <Link href="/integracoes" className="underline">
            padrões de tributação da empresa
          </Link>
          . Na dúvida sobre um código, confirme com o seu contador.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {texto("ncm", "NCM", {
          placeholder: "Ex.: 2202.10.00",
          descricao: "Obrigatório para nota. 8 dígitos, pontuação é ignorada.",
        })}
        {texto("cest", "CEST", {
          placeholder: "Ex.: 0300700",
          descricao: "Só para produtos com substituição tributária.",
        })}
        {texto("cfop", "CFOP", {
          placeholder: padroes?.cfop
            ? `Padrão da empresa: ${padroes.cfop}`
            : "Ex.: 5102",
          descricao:
            "5102 revenda · 5405 revenda com ST · 5101 produção própria",
          list: "cfops-varejo",
        })}
        <datalist id="cfops-varejo">
          {CFOPS_VAREJO.map((cfop) => (
            <option key={cfop.codigo} value={cfop.codigo}>
              {cfop.descricao}
            </option>
          ))}
        </datalist>

        {select("origem", "Origem da mercadoria", ORIGENS, "Nacional (0)")}
        {select(
          "cstIcms",
          simples === false ? "CST do ICMS" : "CSOSN (ICMS no Simples)",
          simples === false
            ? CST_ICMS
            : simples
              ? CSOSN
              : [...CSOSN, ...CST_ICMS],
          rotuloPadrao(padroes?.cstIcms),
        )}
        {select(
          "cstPis",
          "CST do PIS",
          CST_PIS_COFINS,
          rotuloPadrao(padroes?.cstPis),
        )}
        {select(
          "cstCofins",
          "CST do COFINS",
          CST_PIS_COFINS,
          rotuloPadrao(padroes?.cstCofins),
        )}

        {/* No Simples o imposto sai pelo DAS: alíquota por produto não entra na nota. */}
        {simples === false && (
          <>
            <Aliquota control={c} campo="aliqIcms" label="Alíquota ICMS (%)" />
            <Aliquota control={c} campo="aliqPis" label="Alíquota PIS (%)" />
            <Aliquota
              control={c}
              campo="aliqCofins"
              label="Alíquota COFINS (%)"
            />
          </>
        )}

        <div className="text-sm font-medium sm:col-span-3">
          Reforma tributária (IBS/CBS)
        </div>
        {texto("cstIbsCbs", "CST do IBS/CBS", {
          placeholder: "Ex.: 000",
          descricao: "3 dígitos.",
        })}
        {texto("cClassTrib", "cClassTrib", {
          placeholder: "Ex.: 000001",
          descricao: "Classificação tributária da reforma, 6 dígitos.",
        })}
      </CardContent>
    </Card>
  );
}

type AliquotaCampo = "aliqIcms" | "aliqPis" | "aliqCofins";

function Aliquota({
  control,
  campo,
  label,
}: {
  control: Control<
    Record<CampoFiscal | AliquotaCampo, string | number | undefined>
  >;
  campo: AliquotaCampo;
  label: string;
}) {
  return (
    <Controller
      control={control}
      name={campo}
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor={campo}>{label}</FieldLabel>
          <Input
            id={campo}
            type="number"
            step="0.01"
            min={0}
            max={100}
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
  );
}
