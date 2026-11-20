import { describe, expect, it } from "vitest";
import { ehNomePadrao, proximoNomeLivre, raizDoNome } from "./page-names";

describe("nomes de página", () => {
  it("reconhece o nome padrão, com ou sem cópias", () => {
    expect(ehNomePadrao("Página 1")).toBe(true);
    expect(ehNomePadrao("Página 1 (cópia) (cópia) (cópia)")).toBe(true);
    expect(ehNomePadrao("Arranjos florais")).toBe(false);
  });

  it("tira cópias e o número do fim", () => {
    expect(raizDoNome("Frios 2")).toBe("Frios");
    expect(raizDoNome("Página 1 (cópia) (cópia)")).toBe("Página");
  });

  it("duplicar continua a série em vez de empilhar (cópia)", () => {
    expect(proximoNomeLivre(["Frios", "Frios 2"], "Frios 2")).toBe("Frios 3");
    expect(proximoNomeLivre(["Página 1", "Página 2"], "Página 1")).toBe(
      "Página 3",
    );
  });

  it("nome livre é usado como está", () => {
    expect(proximoNomeLivre(["Página 1"], "Arranjos florais")).toBe(
      "Arranjos florais",
    );
  });
});
