import { describe, expect, it } from "vitest";
import { ALVOS } from "../../domain/alvos";
import { PCPEDC, PCPEDI, PCPRODUT } from "../../domain/fixtures";
import { origemSchema } from "../../domain/mapeamento";
import type { PedidoDeLeituraMapeada } from "../../ports/banco";
import {
  citar,
  padraoDeBusca,
  sqlAmostra,
  sqlLeituraMapeada,
  sqlPerfilDaColuna,
  tipoDeDado,
  valorCru,
} from "./sql";

const precoPelasVendas = origemSchema.parse({
  tabela: { schema: "LGCARVALHO", nome: "PCPEDI" },
  juncao: {
    tabela: { schema: "LGCARVALHO", nome: "PCPEDC" },
    de: "NUMPED",
    para: "NUMPED",
  },
  colunas: {
    codigoProduto: { de: "base", nome: "CODPROD" },
    preco: { de: "base", nome: "PTABELA" },
    regiao: { de: "juncao", nome: "NUMREGIAO" },
    data: { de: "base", nome: "DATA" },
  },
  filtros: [
    {
      coluna: { de: "base", nome: "POSICAO" },
      operador: "diferente",
      valores: ["C"],
    },
  ],
  janela: { coluna: { de: "base", nome: "DATA" }, dias: 90 },
});

function pedido(
  extra: Partial<PedidoDeLeituraMapeada> = {},
): PedidoDeLeituraMapeada {
  return {
    alvo: ALVOS.preco,
    origem: precoPelasVendas,
    base: PCPEDI,
    juncao: PCPEDC,
    limite: 10,
    codigo: null,
    diasNoMaximo: null,
    ...extra,
  };
}

describe("citar", () => {
  it("põe aspas no nome válido", () => {
    expect(citar("PCPRODUT")).toBe('"PCPRODUT"');
    expect(citar("TB$X#1")).toBe('"TB$X#1"');
  });

  it("recusa qualquer coisa que pareça SQL", () => {
    expect(() => citar('X" OR 1=1 --')).toThrow();
    expect(() => citar("A;DROP")).toThrow();
  });
});

describe("tipoDeDado", () => {
  it("reduz os tipos do Oracle", () => {
    expect(tipoDeDado("NUMBER")).toBe("numero");
    expect(tipoDeDado("VARCHAR2")).toBe("texto");
    expect(tipoDeDado("DATE")).toBe("data");
    expect(tipoDeDado("TIMESTAMP(6)")).toBe("data");
    expect(tipoDeDado("CLOB")).toBe("outro");
  });
});

describe("sqlAmostra", () => {
  it("qualifica pelo dono e pagina com bind", () => {
    const { sql, binds } = sqlAmostra({
      tabela: PCPRODUT,
      colunas: ["CODPROD", "DESCRICAO"],
      filtro: null,
      ordem: null,
      pagina: 2,
      porPagina: 50,
    });
    expect(sql).toBe(
      'SELECT "CODPROD", "DESCRICAO" FROM "LGCARVALHO"."PCPRODUT" OFFSET :inicio ROWS FETCH NEXT :quantos ROWS ONLY',
    );
    expect(binds).toEqual({ inicio: 100, quantos: 51 });
  });

  it("filtra por bind e converte número", () => {
    const { sql, binds } = sqlAmostra({
      tabela: PCPRODUT,
      colunas: ["CODPROD"],
      filtro: { coluna: "CODPROD", valor: "108238" },
      ordem: { coluna: "CODPROD", direcao: "desc" },
      pagina: 0,
      porPagina: 50,
    });
    expect(sql).toContain('WHERE "CODPROD" = :valor');
    expect(sql).toContain('ORDER BY "CODPROD" DESC');
    expect(binds.valor).toBe(108238);
  });

  it("filtra data por intervalo, sem TRUNC na coluna", () => {
    const { sql } = sqlAmostra({
      tabela: PCPEDI,
      colunas: ["NUMPED"],
      filtro: { coluna: "DATA", valor: "2026-10-21" },
      ordem: null,
      pagina: 0,
      porPagina: 50,
    });
    expect(sql).toContain(
      `"DATA" >= TO_DATE(:valor, 'YYYY-MM-DD') AND "DATA" < TO_DATE(:valor, 'YYYY-MM-DD') + 1`,
    );
    expect(sql).not.toContain("TRUNC(");
  });

  it("recusa coluna que não está na estrutura", () => {
    expect(() =>
      sqlAmostra({
        tabela: PCPRODUT,
        colunas: ["SENHA"],
        filtro: null,
        ordem: null,
        pagina: 0,
        porPagina: 50,
      }),
    ).toThrow("não existe");
  });
});

describe("sqlLeituraMapeada", () => {
  it("monta junção, janela, filtro e último por produto e região", () => {
    const { sql, binds } = sqlLeituraMapeada(pedido());
    expect(sql).toContain(
      'FROM "LGCARVALHO"."PCPEDI" b JOIN "LGCARVALHO"."PCPEDC" j ON j."NUMPED" = b."NUMPED"',
    );
    expect(sql).toContain('b."DATA" >= TRUNC(SYSDATE) - :dias');
    expect(sql).toContain('b."POSICAO" <> :f0_0');
    expect(sql).toContain(
      'ROW_NUMBER() OVER (PARTITION BY b."CODPROD", j."NUMREGIAO" ORDER BY b."DATA" DESC)',
    );
    expect(sql).toContain('j."NUMREGIAO" AS "regiao"');
    expect(sql).toContain('WHERE "RN__" = 1');
    expect(binds).toEqual({ limite: 10, dias: 90, f0_0: "C" });
  });

  it("encurta a janela no teste e filtra pelo código como número", () => {
    const { sql, binds } = sqlLeituraMapeada(
      pedido({ diasNoMaximo: 3, codigo: "108238" }),
    );
    expect(binds.dias).toBe(3);
    expect(binds.codigo).toBe(108238);
    expect(sql).toContain('b."CODPROD" = :codigo');
  });

  it("nunca interpola valor de filtro", () => {
    const origem = {
      ...precoPelasVendas,
      filtros: [
        {
          coluna: { de: "base" as const, nome: "POSICAO" },
          operador: "em" as const,
          valores: ["F'; DROP TABLE X --", "L"],
        },
      ],
    };
    const { sql, binds } = sqlLeituraMapeada(pedido({ origem }));
    expect(sql).not.toContain("DROP");
    expect(sql).toContain('b."POSICAO" IN (:f0_0, :f0_1)');
    expect(binds.f0_0).toBe("F'; DROP TABLE X --");
  });

  it("sem histórico, lê direto e ordena pela janela", () => {
    const origem = origemSchema.parse({
      tabela: { schema: "LGCARVALHO", nome: "PCPRODUT" },
      colunas: {
        codigo: { de: "base", nome: "CODPROD" },
        nome: { de: "base", nome: "DESCRICAO" },
      },
    });
    const { sql } = sqlLeituraMapeada({
      alvo: ALVOS.produto,
      origem,
      base: PCPRODUT,
      juncao: null,
      limite: 10,
      codigo: null,
      diasNoMaximo: null,
    });
    expect(sql).toBe(
      'SELECT b."CODPROD" AS "codigo", b."DESCRICAO" AS "nome" FROM "LGCARVALHO"."PCPRODUT" b FETCH FIRST :limite ROWS ONLY',
    );
  });

  it("recusa coluna mapeada que não existe na estrutura", () => {
    const origem = {
      ...precoPelasVendas,
      colunas: {
        ...precoPelasVendas.colunas,
        preco: { de: "base" as const, nome: "PVENDA" },
      },
    };
    expect(() => sqlLeituraMapeada(pedido({ origem }))).toThrow("não existe");
  });
});

describe("valorCru", () => {
  it("serializa o que vem do driver", () => {
    expect(valorCru(new Date(2026, 9, 22, 0, 0, 0))).toBe(
      "2026-10-22T00:00:00",
    );
    expect(valorCru(21.454)).toBe(21.454);
    expect(valorCru(undefined)).toBeNull();
    expect(valorCru(Buffer.from("x"))).toBeNull();
  });
});

describe("sqlPerfilDaColuna", () => {
  it("lê a tabela inteira quando é pequena", () => {
    const { estatisticas, maisComuns, formatos } = sqlPerfilDaColuna({
      tabela: PCPRODUT,
      coluna: "DESCRICAO",
      percentualDeBlocos: null,
      maisComuns: 15,
      comFormatos: true,
    });
    expect(estatisticas.sql).toContain('COUNT(DISTINCT "DESCRICAO")');
    expect(estatisticas.sql).toContain('MAX(LENGTH("DESCRICAO"))');
    expect(estatisticas.sql).not.toContain("SAMPLE");
    expect(maisComuns.binds).toEqual({ quantos: 15 });
    expect(formatos?.sql).toContain("TRANSLATE(SUBSTR(TO_CHAR(");
  });

  it("amostra blocos em tabela grande e não tira formato de data", () => {
    const { estatisticas, formatos } = sqlPerfilDaColuna({
      tabela: PCPEDI,
      coluna: "DATA",
      percentualDeBlocos: 1.7654,
      maisComuns: 10,
      comFormatos: true,
    });
    expect(estatisticas.sql).toContain('"PCPEDI" SAMPLE BLOCK (1.7654)');
    expect(formatos).toBeNull();
  });

  it("recusa percentual fora do intervalo do Oracle", () => {
    expect(() =>
      sqlPerfilDaColuna({
        tabela: PCPEDI,
        coluna: "DATA",
        percentualDeBlocos: 100,
        maisComuns: 10,
        comFormatos: false,
      }),
    ).toThrow("Percentual");
  });
});

describe("padraoDeBusca", () => {
  it("põe curinga dos dois lados e escapa os do usuário", () => {
    expect(padraoDeBusca(" cnpj ")).toBe("%CNPJ%");
    expect(padraoDeBusca("COD_PROD")).toBe("%COD\\_PROD%");
    expect(padraoDeBusca("100%")).toBe("%100\\%%");
  });
});

describe("sqlLeituraMapeada paginada", () => {
  const produto = origemSchema.parse({
    tabela: { schema: "LGCARVALHO", nome: "PCPRODUT" },
    colunas: {
      codigo: { de: "base", nome: "CODPROD" },
      nome: { de: "base", nome: "DESCRICAO" },
    },
  });

  it("primeira página ordena pela chave, sem cursor", () => {
    const { sql, binds } = sqlLeituraMapeada({
      alvo: ALVOS.produto,
      origem: produto,
      base: PCPRODUT,
      juncao: null,
      limite: 2000,
      codigo: null,
      diasNoMaximo: null,
      paginacao: { depoisDe: null },
    });
    expect(sql).toContain(
      'WHERE b."CODPROD" IS NOT NULL ORDER BY b."CODPROD" ASC FETCH FIRST :limite ROWS ONLY',
    );
    expect(binds).toEqual({ limite: 2000 });
  });

  it("continua depois do último código", () => {
    const { sql, binds } = sqlLeituraMapeada({
      alvo: ALVOS.produto,
      origem: produto,
      base: PCPRODUT,
      juncao: null,
      limite: 2000,
      codigo: null,
      diasNoMaximo: null,
      paginacao: { depoisDe: [108238] },
    });
    expect(sql).toContain('b."CODPROD" > :k0');
    expect(binds.k0).toBe(108238);
  });

  it("chave dupla do estoque compara os dois campos", () => {
    const estoque = origemSchema.parse({
      tabela: { schema: "LGCARVALHO", nome: "PCPRODUT" },
      colunas: {
        codigoProduto: { de: "base", nome: "CODPROD" },
        filial: { de: "base", nome: "UNIDADE" },
        quantidade: { de: "base", nome: "QTUNITCX" },
      },
    });
    const { sql } = sqlLeituraMapeada({
      alvo: ALVOS.estoque,
      origem: estoque,
      base: PCPRODUT,
      juncao: null,
      limite: 5000,
      codigo: null,
      diasNoMaximo: null,
      paginacao: { depoisDe: [108238, "2"] },
    });
    expect(sql).toContain(
      '(b."CODPROD" > :k0 OR (b."CODPROD" = :k0 AND b."UNIDADE" > :k1))',
    );
    expect(sql).toContain('ORDER BY b."CODPROD" ASC, b."UNIDADE" ASC');
  });

  it("recusa paginar sem a chave mapeada", () => {
    const semChave = origemSchema.parse({
      tabela: { schema: "LGCARVALHO", nome: "PCPRODUT" },
      colunas: { nome: { de: "base", nome: "DESCRICAO" } },
    });
    expect(() =>
      sqlLeituraMapeada({
        alvo: ALVOS.produto,
        origem: semChave,
        base: PCPRODUT,
        juncao: null,
        limite: 10,
        codigo: null,
        diasNoMaximo: null,
        paginacao: { depoisDe: null },
      }),
    ).toThrow("precisa da chave");
  });
});
