import { describe, expect, it } from "vitest";
import { ALVOS } from "./alvos";
import { converterLinha } from "./converter";

describe("converterLinha", () => {
  it("converte o preço do Purelac vindo do Winthor", () => {
    const { valores, erros } = converterLinha(
      ALVOS.preco,
      {
        codigoProduto: 108238,
        preco: 21.454,
        regiao: 11,
        data: "2026-10-22T00:00:00",
      },
      {},
    );
    expect(erros).toEqual([]);
    expect(valores).toEqual({
      codigoProduto: "108238",
      preco: 21.454,
      regiao: "11",
      data: "2026-10-22T00:00:00",
    });
  });

  it("aceita número em texto com vírgula", () => {
    const { valores } = converterLinha(
      ALVOS.preco,
      { codigoProduto: "1", preco: "1.234,50", regiao: "1" },
      {},
    );
    expect(valores.preco).toBe(1234.5);
  });

  it("marca o campo inválido sem derrubar a linha", () => {
    const { valores, erros } = converterLinha(
      ALVOS.preco,
      { codigoProduto: "1", preco: "abc", regiao: "1" },
      {},
    );
    expect(valores.codigoProduto).toBe("1");
    expect(erros).toEqual(['Preço: "abc" não é número.']);
  });

  it("acusa obrigatório vazio", () => {
    const { erros } = converterLinha(
      ALVOS.produto,
      { codigo: "  ", nome: "Arroz" },
      {},
    );
    expect(erros).toEqual(["Código: vazio."]);
  });

  it("aplica as conversões de booleano", () => {
    const linha = { codigo: "1", nome: "Arroz", ativo: null };
    expect(
      converterLinha(ALVOS.produto, linha, { ativo: "vazioEhVerdadeiro" })
        .valores.ativo,
    ).toBe(true);
    expect(
      converterLinha(
        ALVOS.produto,
        { ...linha, ativo: "2026-01-01T00:00:00.000Z" },
        { ativo: "vazioEhVerdadeiro" },
      ).valores.ativo,
    ).toBe(false);
    expect(
      converterLinha(
        ALVOS.produto,
        { ...linha, ativo: "S" },
        { ativo: "simEhVerdadeiro" },
      ).valores.ativo,
    ).toBe(true);
  });

  it("normaliza data com fuso para ISO", () => {
    const { valores } = converterLinha(
      ALVOS.promocao,
      {
        codigoProduto: "1",
        precoPromocional: 8.99,
        fim: "2026-10-22T03:00:00Z",
      },
      {},
    );
    expect(valores.fim).toBe("2026-10-22T03:00:00.000Z");
  });

  it("só deixa passar código de barras válido", () => {
    const conversoes = { ean: "gtinValido" as const };
    const ean = (valor: string | number) =>
      converterLinha(
        ALVOS.produto,
        { codigo: "1", nome: "X", ean: valor },
        conversoes,
      ).valores.ean;
    expect(ean(7898945743488)).toBe("7898945743488");
    expect(ean("78913127")).toBe("78913127");
    expect(ean("17898945743485")).toBe("17898945743485");
    // Winthor repete o código do produto no campo do EAN quando não há um.
    expect(ean(299685)).toBeNull();
    expect(ean("7898945743487")).toBeNull();
    expect(ean("0000000000000")).toBeNull();
  });

  it("tira a máscara com somente dígitos", () => {
    const { valores } = converterLinha(
      ALVOS.cliente,
      {
        codigo: "1",
        nome: "X",
        documento: "12.345.678/0001-90",
        celular: "(86) 99999-0000",
      },
      { documento: "somenteDigitos", celular: "somenteDigitos" },
    );
    expect(valores.documento).toBe("12345678000190");
    expect(valores.celular).toBe("86999990000");
  });

  it("recusa data inválida", () => {
    const { erros } = converterLinha(
      ALVOS.promocao,
      { codigoProduto: "1", precoPromocional: 8.99, fim: "ontem" },
      {},
    );
    expect(erros).toEqual(['Fim: "ontem" não é data.']);
  });

  it("ignora campos que não vieram na linha", () => {
    const { valores } = converterLinha(
      ALVOS.produto,
      { codigo: 1, nome: "Arroz" },
      {},
    );
    expect(Object.keys(valores)).toEqual(["codigo", "nome"]);
  });
});
