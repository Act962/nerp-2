import { describe, expect, it } from "vitest";
import { chunkBytes } from "./chunk";

describe("chunkBytes", () => {
  it("divide exatamente quando o tamanho é múltiplo", () => {
    const pedacos = chunkBytes(Uint8Array.from([1, 2, 3, 4]), 2);
    expect(pedacos.map((p) => [...p])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("deixa o resto no último pedaço", () => {
    const pedacos = chunkBytes(Uint8Array.from([1, 2, 3, 4, 5]), 2);
    expect(pedacos).toHaveLength(3);
    expect([...pedacos[2]]).toEqual([5]);
  });

  it("devolve um pedaço só quando cabe tudo", () => {
    expect(chunkBytes(Uint8Array.from([1, 2]), 20)).toHaveLength(1);
  });

  it("não devolve nada para entrada vazia", () => {
    expect(chunkBytes(new Uint8Array(), 20)).toEqual([]);
  });

  it("recusa tamanho inválido em vez de girar para sempre", () => {
    expect(() => chunkBytes(Uint8Array.from([1]), 0)).toThrow();
  });
});
