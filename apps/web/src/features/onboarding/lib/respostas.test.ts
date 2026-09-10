import { describe, expect, it } from "vitest";
import {
  codificarRespostas,
  lerRespostasDoWizard,
  RESPOSTAS_VAZIAS,
} from "./respostas";

describe("respostas do wizard", () => {
  it("vai e volta pelo cookie", () => {
    const respostas = {
      segment: "VAREJO" as const,
      nicho: "supermercados" as const,
      interesses: ["pdv" as const, "estoque" as const],
    };
    expect(lerRespostasDoWizard(codificarRespostas(respostas))).toEqual(
      respostas,
    );
  });

  it("valor estranho vira respostas vazias, nunca erro", () => {
    expect(lerRespostasDoWizard(undefined)).toEqual(RESPOSTAS_VAZIAS);
    expect(lerRespostasDoWizard("%%%")).toEqual(RESPOSTAS_VAZIAS);
    expect(lerRespostasDoWizard(encodeURIComponent('{"nicho":"lua"}'))).toEqual(
      RESPOSTAS_VAZIAS,
    );
  });

  it("interesse desconhecido derruba o conjunto para o vazio (schema fechado)", () => {
    const cru = encodeURIComponent(JSON.stringify({ interesses: ["hackear"] }));
    expect(lerRespostasDoWizard(cru)).toEqual(RESPOSTAS_VAZIAS);
  });
});
