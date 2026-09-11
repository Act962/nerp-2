import { describe, expect, it } from "vitest";
import { classificarAbc, type ItemVendido } from "./curva-abc";

/**
 * A curva ABC decide onde a loja põe atenção e dinheiro. O que estes testes
 * prendem é o que costuma sair errado numa implementação apressada: cortar por
 * POSIÇÃO em vez de acumulado, deixar o item que cruza os 80% cair para B, e
 * contar como "classe C" produto que simplesmente não vendeu.
 */

function item(produtoId: string, valor: number, volume: number): ItemVendido {
  return { produtoId, nome: produtoId, sku: null, valor, volume };
}

describe("classificarAbc", () => {
  it("ordena do maior para o menor no critério pedido", () => {
    const curva = classificarAbc(
      [item("b", 50, 1), item("a", 100, 1), item("c", 10, 1)],
      "valor",
    );
    expect(curva.itens.map((i) => i.produtoId)).toEqual(["a", "b", "c"]);
    expect(curva.itens.map((i) => i.posicao)).toEqual([1, 2, 3]);
  });

  it("o item que CRUZA os 80% ainda é A", () => {
    // Ordenado: x(79%), z(19%), y(2%). O z leva o acumulado de 79% a 98%, ou
    // seja, é ele que atravessa a linha dos 80%. Classificar pelo acumulado já
    // somado o jogaria em C e deixaria a classe A com 79% — abaixo do que a
    // própria classe promete.
    const curva = classificarAbc(
      [item("x", 79, 1), item("y", 2, 1), item("z", 19, 1)],
      "valor",
    );
    const classes = Object.fromEntries(
      curva.itens.map((i) => [i.produtoId, i.classe]),
    );
    expect(classes.x).toBe("A");
    expect(classes.z).toBe("A");
    expect(classes.y).toBe("C");
  });

  it("respeita os cortes 80/95 em uma curva concentrada", () => {
    const curva = classificarAbc(
      [
        item("a", 800, 1),
        item("b", 100, 1),
        item("c", 50, 1),
        item("d", 30, 1),
        item("e", 20, 1),
      ],
      "valor",
    );
    const porId = Object.fromEntries(
      curva.itens.map((i) => [i.produtoId, i.classe]),
    );
    // 80% | 90% | 95% | 98% | 100%
    expect(porId.a).toBe("A");
    expect(porId.b).toBe("B");
    expect(porId.c).toBe("B");
    expect(porId.d).toBe("C");
    expect(porId.e).toBe("C");
  });

  it("valor e volume dão listas diferentes — é o ponto de ter os dois", () => {
    // O barato de alto giro: A em volume, C em valor.
    const itens = [
      item("caro", 1000, 2),
      item("barato", 20, 500),
      item("medio", 100, 10),
    ];
    const porValor = classificarAbc(itens, "valor");
    const porVolume = classificarAbc(itens, "volume");

    expect(porValor.itens[0].produtoId).toBe("caro");
    expect(porVolume.itens[0].produtoId).toBe("barato");
    expect(porVolume.itens.find((i) => i.produtoId === "barato")?.classe).toBe(
      "A",
    );
  });

  it("produto que não vendeu fica de fora, e não vira classe C", () => {
    // Contá-lo inflaria C e faria a curva parecer mais concentrada do que é.
    const curva = classificarAbc(
      [item("vendeu", 100, 5), item("parado", 0, 0)],
      "valor",
    );
    expect(curva.itens).toHaveLength(1);
    expect(curva.itens[0].produtoId).toBe("vendeu");
  });

  it("no critério volume, item com valor mas sem unidade fica de fora", () => {
    const curva = classificarAbc(
      [item("normal", 100, 5), item("soValor", 50, 0)],
      "volume",
    );
    expect(curva.itens.map((i) => i.produtoId)).toEqual(["normal"]);
  });

  it("o acumulado do último item fecha em 100%", () => {
    const curva = classificarAbc(
      [item("a", 30, 1), item("b", 45, 1), item("c", 25, 1)],
      "valor",
    );
    expect(curva.itens.at(-1)?.acumulado).toBeCloseTo(1, 10);
    expect(curva.total).toBe(100);
  });

  it("as fatias somam 1", () => {
    const curva = classificarAbc(
      [item("a", 33, 1), item("b", 33, 1), item("c", 34, 1)],
      "valor",
    );
    const soma = curva.itens.reduce((s, i) => s + i.fatia, 0);
    expect(soma).toBeCloseTo(1, 10);
  });

  it("o resumo por classe bate com os itens", () => {
    const curva = classificarAbc(
      [item("a", 800, 8), item("b", 100, 1), item("c", 100, 1)],
      "valor",
    );
    const a = curva.classes.find((c) => c.classe === "A");
    expect(a?.itens).toBe(1);
    expect(a?.valor).toBe(800);
    expect(a?.volume).toBe(8);
    expect(a?.fatia).toBeCloseTo(0.8, 10);

    const somaDosItens = curva.classes.reduce((s, c) => s + c.itens, 0);
    expect(somaDosItens).toBe(curva.itens.length);
  });

  it("lista vazia não quebra nem divide por zero", () => {
    const curva = classificarAbc([], "valor");
    expect(curva.itens).toEqual([]);
    expect(curva.total).toBe(0);
    expect(curva.classes.every((c) => c.fatia === 0)).toBe(true);
  });

  it("um único produto é toda a curva", () => {
    const curva = classificarAbc([item("unico", 500, 3)], "valor");
    expect(curva.itens[0].classe).toBe("A");
    expect(curva.itens[0].acumulado).toBe(1);
    expect(curva.itens[0].fatia).toBe(1);
  });
});
