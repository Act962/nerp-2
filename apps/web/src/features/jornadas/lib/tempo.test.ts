import { describe, expect, it } from "vitest";
import type { Jornada, Passo } from "../catalogo/tipos";
import {
  minutosDaJornada,
  tempoMinimoDaJornada,
  tempoMinimoDoPasso,
} from "./tempo";

function passo(parcial: Partial<Passo> = {}): Passo {
  return { tipo: "ler", titulo: "T", texto: "Um texto", ...parcial };
}

function jornadaCom(passos: Passo[]): Jornada {
  return {
    id: "teste",
    modulo: "produtos",
    titulo: "Teste",
    descricao: "Jornada de teste",
    rota: "/produtos",
    starsSugeridas: 5,
    passos,
  };
}

describe("tempoMinimoDoPasso", () => {
  it("nunca fica abaixo do piso, por menor que seja o texto", () => {
    expect(tempoMinimoDoPasso(passo({ titulo: "Oi", texto: "Tudo" }))).toBe(
      2000,
    );
  });

  it("cresce com o tamanho do texto", () => {
    const curto = tempoMinimoDoPasso(
      passo({ titulo: "A", texto: "uma frase" }),
    );
    const longo = tempoMinimoDoPasso(
      passo({
        titulo: "A",
        texto: Array.from({ length: 40 }, () => "palavra").join(" "),
      }),
    );
    expect(longo).toBeGreaterThan(curto);
  });

  it("o valor declarado manda sobre a conta por palavras", () => {
    expect(tempoMinimoDoPasso(passo({ tempoMinimoMs: 500 }))).toBe(500);
  });

  it("aceita zero declarado — é como se desliga a espera de um passo", () => {
    expect(tempoMinimoDoPasso(passo({ tempoMinimoMs: 0 }))).toBe(0);
  });
});

describe("tempoMinimoDaJornada", () => {
  const jornada = jornadaCom([
    passo({ tempoMinimoMs: 1000 }),
    passo({ tempoMinimoMs: 2500 }),
  ]);

  it("soma os passos", () => {
    expect(tempoMinimoDaJornada(jornada)).toBe(3500);
  });

  it("arredonda os minutos para cima — prometer menos irrita", () => {
    expect(minutosDaJornada(jornada)).toBe(1);
    expect(
      minutosDaJornada(jornadaCom([passo({ tempoMinimoMs: 61_000 })])),
    ).toBe(2);
  });
});
