import { describe, expect, it } from "vitest";
import { prepararFiscalCliente } from "./_fiscal";

describe("prepararFiscalCliente", () => {
  it("normaliza UF, IE e vazios", () => {
    expect(
      prepararFiscalCliente({
        state: " pi ",
        cityCode: "2211001",
        stateRegistration: "19.456.789-0",
        ieIndicator: "1",
      }),
    ).toEqual({
      ok: true,
      dados: {
        state: "PI",
        cityCode: "2211001",
        stateRegistration: "194567890",
        ieIndicator: "1",
      },
    });
    expect(prepararFiscalCliente({ state: "", cityCode: "" })).toEqual({
      ok: true,
      dados: {
        state: null,
        cityCode: null,
        stateRegistration: undefined,
        ieIndicator: undefined,
      },
    });
  });

  it("campo ausente continua ausente (o update não mexe nele)", () => {
    const r = prepararFiscalCliente({});
    expect(r.ok && r.dados).toEqual({
      state: undefined,
      cityCode: undefined,
      stateRegistration: undefined,
      ieIndicator: undefined,
    });
  });

  it("recusa UF por extenso e código IBGE incompleto", () => {
    expect(prepararFiscalCliente({ state: "Piauí" }).ok).toBe(false);
    expect(prepararFiscalCliente({ cityCode: "221100" }).ok).toBe(false);
  });

  it("contribuinte precisa de IE; isento e não contribuinte não guardam IE", () => {
    expect(prepararFiscalCliente({ ieIndicator: "1" })).toMatchObject({
      ok: false,
    });
    const isento = prepararFiscalCliente({
      ieIndicator: "2",
      stateRegistration: "123",
    });
    expect(isento.ok && isento.dados.stateRegistration).toBeNull();
  });
});
