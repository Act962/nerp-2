import { describe, expect, it } from "vitest";
import { LARGURA_DO_NO, posicionar } from "./layout";

function caixa(
  posicoes: Map<string, { x: number; y: number }>,
  altura: number,
) {
  const xs = [...posicoes.values()].map((p) => p.x);
  const ys = [...posicoes.values()].map((p) => p.y);
  return {
    largura: Math.max(...xs) + LARGURA_DO_NO - Math.min(...xs),
    altura: Math.max(...ys) + altura - Math.min(...ys),
  };
}

describe("posicionar", () => {
  it("põe quem aponta à esquerda de quem é apontado", () => {
    const posicoes = posicionar(
      [
        { id: "item", altura: 200 },
        { id: "produto", altura: 200 },
      ],
      [{ de: "item", para: "produto" }],
    );
    expect(posicoes.get("item")?.x).toBeLessThan(
      posicoes.get("produto")?.x ?? 0,
    );
  });

  it("quebra uma faixa enorme em colunas, sem virar uma torre", () => {
    const nos = Array.from({ length: 100 }, (_, i) => ({
      id: `t${i}`,
      altura: 230,
    }));
    nos.push({ id: "mestra", altura: 230 });
    const arestas = nos
      .filter((no) => no.id !== "mestra")
      .map((no) => ({ de: no.id, para: "mestra" }));
    const { largura, altura } = caixa(posicionar(nos, arestas), 230);
    expect(altura / largura).toBeLessThan(1.5);
  });

  it("deixa as soltas numa grade abaixo das ligadas", () => {
    const posicoes = posicionar(
      [
        { id: "a", altura: 200 },
        { id: "b", altura: 200 },
        { id: "solta", altura: 200 },
      ],
      [{ de: "a", para: "b" }],
    );
    const fundoDasLigadas = Math.max(
      posicoes.get("a")?.y ?? 0,
      posicoes.get("b")?.y ?? 0,
    );
    expect(posicoes.get("solta")?.y).toBeGreaterThan(fundoDasLigadas + 200);
  });
});
