import { describe, expect, it } from "vitest";
import {
  descreverRecorte,
  escolhasPara,
  gruposDeFilial,
  montarConfig,
  oQueFalta,
  resolverPeriodo,
  SEM_FILIAL,
  TODAS_AS_FILIAIS,
} from "./indicadores";

const FILIAIS = [
  { codigo: "1", nome: "MATRIZ" },
  { codigo: "2", nome: "FILIAL CENTRO" },
];

// 15/10/2026 às 12h em Fortaleza.
const AGORA = new Date("2026-10-15T15:00:00Z");

describe("oQueFalta", () => {
  it("sem filial e sem período, pergunta os dois", () => {
    expect(oQueFalta("inadimplencia", {})).toEqual(["filial", "periodo"]);
  });

  it("com os dois, não pergunta nada", () => {
    expect(
      oQueFalta("inadimplencia", {
        filiais: ["1"],
        periodo: { tipo: "haMaisDe", dias: 90 },
      }),
    ).toEqual([]);
  });

  it("período de tipo que não serve ao indicador conta como faltando", () => {
    expect(
      oQueFalta("vendas", {
        filiais: ["1"],
        periodo: { tipo: "haMaisDe", dias: 90 },
      }),
    ).toEqual(["periodo"]);
  });
});

describe("escolhasPara", () => {
  it("oferece as filiais lidas, mais Todas", () => {
    const [filial] = escolhasPara("inadimplencia", ["filial"], FILIAIS);
    expect(filial.opcoes.map((opcao) => opcao.rotulo)).toEqual([
      "Filial 1 · MATRIZ",
      "Filial 2 · FILIAL CENTRO",
      "Todas as filiais",
    ]);
  });

  it("cliente aceita 'sem filial no cadastro', inadimplência não", () => {
    const [clientes] = escolhasPara("clientesSemCompra", ["filial"], FILIAIS);
    expect(clientes.opcoes.map((opcao) => opcao.rotulo)).toContain(
      "Sem filial no cadastro",
    );
  });
});

describe("resolverPeriodo", () => {
  it("há mais de 60 dias desde 2026 vai até hoje − 61", () => {
    expect(
      resolverPeriodo(
        "clientesSemCompra",
        { tipo: "haMaisDe", dias: 60, desde: "2026-01-01" },
        AGORA,
      ),
    ).toEqual({ de: "2026-01-01", ate: "2026-08-15" });
  });

  it("às 22h de Fortaleza ainda é hoje, mesmo já sendo amanhã em UTC", () => {
    const noite = new Date("2026-10-16T01:00:00Z");
    expect(
      resolverPeriodo("vendas", { tipo: "ultimos", dias: 1 }, noite),
    ).toEqual({ de: "2026-10-15", ate: "2026-10-15" });
  });

  it("vencido nunca passa de ontem", () => {
    expect(
      resolverPeriodo("inadimplencia", { tipo: "ultimos", dias: 30 }, AGORA),
    ).toEqual({ de: "2026-09-16", ate: "2026-10-14" });
  });

  it("intervalo invertido vira erro, não consulta vazia", () => {
    expect(
      resolverPeriodo(
        "vendas",
        { tipo: "intervalo", de: "2026-10-10", ate: "2026-10-01" },
        AGORA,
      ),
    ).toHaveProperty("erro");
  });
});

describe("gruposDeFilial", () => {
  it("códigos juntos, vazio separado", () => {
    expect(gruposDeFilial(["1", "2", SEM_FILIAL])).toEqual([
      ["1", "2"],
      [SEM_FILIAL],
    ]);
  });

  it("todas engole o resto", () => {
    expect(gruposDeFilial(["1", TODAS_AS_FILIAIS])).toEqual([null]);
  });
});

describe("montarConfig", () => {
  const intervalo = { de: "2026-01-01", ate: "2026-08-15" };

  it("sem filial vira IS NULL na coluna do indicador", () => {
    const config = montarConfig({
      indicador: "clientesSemCompra",
      filiais: [SEM_FILIAL],
      intervalo,
      medida: {
        aggregation: "COUNT",
        column: null,
        label: "C",
        unit: "number",
      },
    });
    expect(config.filters).toContainEqual({
      column: "CODFILIALNF",
      operator: "isNull",
      values: [],
    });
    expect(config.dateFilter).toEqual({
      column: "DTULTCOMP",
      preset: "custom",
      from: "2026-01-01",
      to: "2026-08-15",
    });
  });

  it("inadimplência sempre filtra parcela não paga", () => {
    const config = montarConfig({
      indicador: "inadimplencia",
      filiais: ["1", "2"],
      intervalo,
      medida: {
        aggregation: "COUNT",
        column: null,
        label: "C",
        unit: "number",
      },
    });
    expect(config.filters).toEqual([
      { column: "DTPAG", operator: "isNull", values: [] },
      { column: "CODFILIAL", operator: "in", values: ["1", "2"] },
    ]);
  });
});

describe("descreverRecorte", () => {
  it("diz filial, datas e a leitura do período", () => {
    expect(
      descreverRecorte({
        indicador: "clientesSemCompra",
        filiais: ["2"],
        periodo: { tipo: "haMaisDe", dias: 60, desde: "2026-01-01" },
        intervalo: { de: "2026-01-01", ate: "2026-08-15" },
        todasAsFiliais: FILIAIS,
      }),
    ).toBe(
      "Clientes sem compra — Filial 2 · FILIAL CENTRO — última compra de 01/01/2026 a 15/08/2026 (há mais de 60 dias, desde 01/01/2026)",
    );
  });
});
