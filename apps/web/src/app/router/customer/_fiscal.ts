import { isUf } from "@nerp/fiscal";

// Dados do cliente que a NF-e (modelo 55) pede no destinatário. Opcionais:
// a NFC-e do balcão só usa o CPF/CNPJ. Validados aqui porque o `update` de
// cliente recebe um input sem schema estrito.

export type CamposFiscaisCliente = {
  state?: string | null;
  cityCode?: string | null;
  stateRegistration?: string | null;
  ieIndicator?: string | null;
};

type Resultado =
  | { ok: true; dados: CamposFiscaisCliente }
  | { ok: false; mensagem: string };

const vazioParaNull = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;

export function prepararFiscalCliente(input: CamposFiscaisCliente): Resultado {
  const uf = vazioParaNull(input.state);
  // `null` precisa sobreviver: é o "limpar" — `?.` o viraria em "não mexer".
  const state = uf ? uf.toUpperCase() : uf;
  const cityCode = vazioParaNull(input.cityCode);
  const ie = vazioParaNull(input.stateRegistration);
  const stateRegistration =
    ie && ie.toUpperCase() !== "ISENTO" ? ie.replace(/\D/g, "") : ie;
  const ieIndicator = vazioParaNull(input.ieIndicator);

  if (state && !isUf(state))
    return { ok: false, mensagem: "UF inválida — use a sigla, ex.: PI" };
  if (cityCode && !/^\d{7}$/.test(cityCode))
    return { ok: false, mensagem: "Código IBGE do município tem 7 dígitos" };
  if (stateRegistration && stateRegistration.length > 14)
    return {
      ok: false,
      mensagem: "Inscrição Estadual tem no máximo 14 dígitos",
    };
  if (ieIndicator && !["1", "2", "9"].includes(ieIndicator))
    return { ok: false, mensagem: "Indicador de IE inválido" };
  // A SEFAZ recusa contribuinte sem IE (rejeição 232) e isento/não
  // contribuinte com IE informada.
  if (ieIndicator === "1" && !stateRegistration)
    return {
      ok: false,
      mensagem: "Contribuinte do ICMS precisa da Inscrição Estadual",
    };

  return {
    ok: true,
    dados: {
      state,
      cityCode,
      stateRegistration:
        ieIndicator && ieIndicator !== "1" ? null : stateRegistration,
      ieIndicator,
    },
  };
}
