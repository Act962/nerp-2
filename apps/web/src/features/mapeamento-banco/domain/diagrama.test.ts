import { describe, expect, it } from "vitest";
import { ligacoesDoSchema } from "./diagrama";
import type { Tabela } from "./estrutura";
import { coluna, tabela } from "./fixtures";

function comChave(t: Tabela, chave: string[]): Tabela {
  return {
    ...t,
    chavePrimaria: chave,
    colunas: t.colunas.map((c) => ({
      ...c,
      chavePrimaria: chave.includes(c.nome),
    })),
  };
}

const PRODUTO = comChave(
  tabela("PCPRODUT", 24_092, [
    coluna("CODPROD", "numero"),
    coluna("DESCRICAO", "texto"),
  ]),
  ["CODPROD"],
);
const PEDIDO = comChave(
  tabela("PCPEDC", 2_395_511, [
    coluna("NUMPED", "numero"),
    coluna("CODCLI", "numero"),
  ]),
  ["NUMPED"],
);
const CLIENTE = comChave(
  tabela("PCCLIENT", 27_882, [coluna("CODCLI", "numero")]),
  ["CODCLI"],
);
const ITEM = comChave(
  tabela("PCPEDI", 16_993_357, [
    coluna("NUMPED", "numero"),
    coluna("CODPROD", "numero"),
    coluna("NUMSEQ", "numero"),
    coluna("CODIGO", "numero"),
  ]),
  ["NUMPED", "CODPROD", "NUMSEQ"],
);
const FILIAL = comChave(tabela("PCFILIAL", 5, [coluna("CODIGO", "texto")]), [
  "CODIGO",
]);

describe("ligacoesDoSchema", () => {
  it("infere pela chave primária de outra tabela", () => {
    const ligacoes = ligacoesDoSchema([PRODUTO, PEDIDO, CLIENTE, ITEM, FILIAL]);
    const pares = ligacoes.map((l) => `${l.de}.${l.colunasDe[0]}→${l.para}`);
    expect(pares).toEqual(
      expect.arrayContaining([
        "LGCARVALHO.PCPEDI.NUMPED→LGCARVALHO.PCPEDC",
        "LGCARVALHO.PCPEDI.CODPROD→LGCARVALHO.PCPRODUT",
        "LGCARVALHO.PCPEDC.CODCLI→LGCARVALHO.PCCLIENT",
      ]),
    );
    expect(ligacoes.every((l) => l.origem === "inferida")).toBe(true);
  });

  it("não liga uma tabela a ela mesma nem por nome genérico", () => {
    const ligacoes = ligacoesDoSchema([PRODUTO, ITEM, FILIAL]);
    expect(ligacoes.some((l) => l.de === l.para)).toBe(false);
    expect(ligacoes.some((l) => l.colunasDe[0] === "CODIGO")).toBe(false);
  });

  it("não desenha quando há mais de um dono possível", () => {
    const outroProduto = comChave(
      tabela("PCPRODUT", 10, [coluna("CODPROD", "numero")], "SWMS"),
      ["CODPROD"],
    );
    const ligacoes = ligacoesDoSchema([PRODUTO, outroProduto, ITEM]);
    expect(ligacoes.some((l) => l.colunasDe[0] === "CODPROD")).toBe(false);
  });

  it("prefere a chave declarada e não repete a inferida", () => {
    const itemComFk: Tabela = {
      ...ITEM,
      relacoes: [
        {
          nome: "FK_PEDI_PEDC",
          colunas: ["NUMPED"],
          referencia: { schema: "LGCARVALHO", nome: "PCPEDC" },
          colunasReferenciadas: ["NUMPED"],
        },
      ],
    };
    const ligacoes = ligacoesDoSchema([PEDIDO, itemComFk]);
    const doNumped = ligacoes.filter((l) => l.colunasDe[0] === "NUMPED");
    expect(doNumped).toHaveLength(1);
    expect(doNumped[0].origem).toBe("declarada");
  });
});
