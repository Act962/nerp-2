"use client";

import { INDICADORES_IE } from "@nerp/fiscal";
import { type Control, Controller, useWatch } from "react-hook-form";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CodigoFiscalSelect } from "@/features/fiscal/components/codigo-fiscal-select";

type CamposCliente = {
  type: "FISICA" | "JURIDICA";
  stateRegistration?: string;
  ieIndicator?: string;
};

/**
 * Inscrição Estadual e situação perante o ICMS — só para empresa (PJ). É o
 * que a NF-e modelo 55 pede do destinatário; a NFC-e do balcão não usa.
 */
export function ClienteFiscalFields<T extends CamposCliente>({
  control,
  disabled,
}: {
  control: Control<T>;
  disabled?: boolean;
}) {
  const c = control as unknown as Control<CamposCliente>;
  const tipo = useWatch({ control: c, name: "type" });
  const indicador = useWatch({ control: c, name: "ieIndicator" });
  if (tipo !== "JURIDICA") return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Controller
        name="ieIndicator"
        control={c}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="ieIndicator">Situação no ICMS</FieldLabel>
            <CodigoFiscalSelect
              id="ieIndicator"
              tabela={INDICADORES_IE}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "")}
              disabled={disabled}
            />
          </Field>
        )}
      />
      <Controller
        name="stateRegistration"
        control={c}
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="stateRegistration">
              Inscrição Estadual
            </FieldLabel>
            <Input
              id="stateRegistration"
              value={field.value ?? ""}
              onChange={field.onChange}
              placeholder="Só números"
              disabled={disabled || (!!indicador && indicador !== "1")}
            />
            <FieldDescription>
              Obrigatória para contribuinte do ICMS.
            </FieldDescription>
          </Field>
        )}
      />
    </div>
  );
}
