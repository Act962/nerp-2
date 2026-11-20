import { describe, expect, it } from "vitest";
import type { ResumoDaTabela } from "./estrutura";
import {
  localizarTabela,
  origemDoPerfil,
  type PerfilAutomatico,
} from "./perfis";

const tabelas: ResumoDaTabela[] = [
  {
    schema: "SWMS",
    nome: "PCPRODUT",
    tipo: "tabela",
    linhas: 10,
    comentario: null,
  },
  {
    schema: "LGCARVALHO",
    nome: "PCPRODUT",
    tipo: "tabela",
    linhas: 24_092,
    comentario: null,
  },
  {
    schema: "LGCARVALHO",
    nome: "PCPEDI",
    tipo: "tabela",
    linhas: 16_993_357,
    comentario: null,
  },
  {
    schema: "LGCARVALHO",
    nome: "PCPEDC",
    tipo: "tabela",
    linhas: 2_395_511,
    comentario: null,
  },
  {
    schema: "SWMS",
    nome: "TBCMS0027",
    tipo: "tabela",
    linhas: 90_683,
    comentario: null,
  },
];

const precoPorTabela: PerfilAutomatico = {
  chave: "winthor-preco-tabela",
  tipo: "preco",
  rotulo: "Tabela de preço",
  descricao: "",
  tabela: "PCTABPR",
  colunas: { codigoProduto: { de: "base", nome: "CODPROD" } },
};

const precoPelasVendas: PerfilAutomatico = {
  chave: "winthor-preco-vendas",
  tipo: "preco",
  rotulo: "Pelas vendas",
  descricao: "",
  tabela: "PCPEDI",
  juncao: { tabela: "PCPEDC", de: "NUMPED", para: "NUMPED" },
  colunas: { codigoProduto: { de: "base", nome: "CODPROD" } },
  janela: { coluna: { de: "base", nome: "DATA" }, dias: 90 },
};

describe("localizarTabela", () => {
  it("prefere o schema principal ao homônimo", () => {
    expect(localizarTabela("PCPRODUT", tabelas, "LGCARVALHO")).toEqual({
      schema: "LGCARVALHO",
      nome: "PCPRODUT",
    });
  });

  it("acha tabela que só existe em outro schema", () => {
    expect(localizarTabela("TBCMS0027", tabelas, "LGCARVALHO")?.schema).toBe(
      "SWMS",
    );
  });

  it("devolve null quando a credencial não enxerga", () => {
    expect(localizarTabela("PCTABPR", tabelas, "LGCARVALHO")).toBeNull();
  });
});

describe("origemDoPerfil", () => {
  it("explica o perfil recusado por falta de permissão", () => {
    const resultado = origemDoPerfil(precoPorTabela, tabelas, "LGCARVALHO");
    expect(resultado).toEqual({
      ok: false,
      motivo:
        "PCTABPR: sem permissão (a tabela não aparece para esta credencial).",
    });
  });

  it("monta a origem com junção e janela", () => {
    const resultado = origemDoPerfil(precoPelasVendas, tabelas, "LGCARVALHO");
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.origem.tabela).toEqual({
      schema: "LGCARVALHO",
      nome: "PCPEDI",
    });
    expect(resultado.origem.juncao?.tabela.nome).toBe("PCPEDC");
    expect(resultado.origem.janela?.dias).toBe(90);
    expect(resultado.origem.filtros).toEqual([]);
  });
});
