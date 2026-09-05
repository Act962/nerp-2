import { describe, expect, it } from "vitest";
import {
  astroPricingSchema,
  estimarFaixa,
  formatarCents,
  lerTabelaDePrecos,
} from "./preco";

/**
 * Este arquivo é a garantia de que o consultor não inventa preço — e ele
 * garante isso porque o número não passa pelo modelo em nenhum momento. Se um
 * caso aqui quebrar, é uma proposta errada saindo para um cliente.
 */

const TABELA = astroPricingSchema.parse({
  ativo: true,
  disclaimer: "Estimativa inicial.",
  portes: [
    {
      id: "pequeno",
      label: "Até 2 lojas",
      lojasAte: 2,
      usuariosAte: 10,
      baseMinCents: 89_000,
      baseMaxCents: 124_000,
    },
    {
      id: "medio",
      label: "Até 10 lojas",
      lojasAte: 10,
      usuariosAte: 60,
      baseMinCents: 180_000,
      baseMaxCents: 260_000,
    },
    {
      id: "grande",
      label: "Acima de 10 lojas",
      lojasAte: null,
      usuariosAte: null,
      baseMinCents: 320_000,
      baseMaxCents: 500_000,
    },
  ],
  modulos: [
    { toolId: "pdv", minCents: 20_000, maxCents: 30_000 },
    { toolId: "estoque", minCents: 10_000, maxCents: 15_000 },
    { toolId: "tracking", minCents: 15_000, maxCents: 25_000 },
  ],
  porLojaAdicional: { minCents: 12_000, maxCents: 18_000 },
  teto: { minCents: 50_000, maxCents: 900_000 },
  setup: { minCents: 150_000, maxCents: 400_000, texto: "pago uma vez" },
});

describe("estimarFaixa — sem tabela", () => {
  it("tabela desligada não devolve valor nenhum", () => {
    const desligada = astroPricingSchema.parse({});
    expect(estimarFaixa(desligada, { lojas: 3 })).toEqual({
      disponivel: false,
      motivo: "sem_tabela",
    });
  });

  it("ativa mas sem portes também não devolve valor", () => {
    const semPortes = astroPricingSchema.parse({ ativo: true, portes: [] });
    expect(estimarFaixa(semPortes).disponivel).toBe(false);
  });
});

describe("estimarFaixa — cálculo", () => {
  it("só a base, quando não há módulo nem loja extra", () => {
    const e = estimarFaixa(TABELA, { lojas: 1, usuarios: 4 });
    expect(e.disponivel).toBe(true);
    if (!e.disponivel) return;
    expect(e.minCents).toBe(89_000);
    expect(e.maxCents).toBe(124_000);
    expect(e.faixa).toBe("R$ 890 a R$ 1.240 por mês");
    expect(e.porte).toBe("Até 2 lojas");
  });

  it("soma os módulos escolhidos, e só eles", () => {
    const e = estimarFaixa(TABELA, {
      lojas: 1,
      toolIds: ["pdv", "estoque", "ferramenta-inexistente"],
    });
    if (!e.disponivel) throw new Error("deveria estar disponível");
    expect(e.minCents).toBe(89_000 + 20_000 + 10_000);
    expect(e.maxCents).toBe(124_000 + 30_000 + 15_000);
  });

  it("cobra por loja que passa do teto do porte", () => {
    const e = estimarFaixa(TABELA, { porteId: "pequeno", lojas: 5 });
    if (!e.disponivel) throw new Error("deveria estar disponível");
    // 3 lojas além das 2 do porte
    expect(e.minCents).toBe(89_000 + 3 * 12_000);
    expect(e.maxCents).toBe(124_000 + 3 * 18_000);
  });

  it("escolhe o porte pelo tamanho da operação", () => {
    expect(
      estimarFaixa(TABELA, { lojas: 6 }).disponivel &&
        estimarFaixa(TABELA, { lojas: 6 }),
    ).toMatchObject({ porte: "Até 10 lojas" });
    expect(estimarFaixa(TABELA, { lojas: 40 })).toMatchObject({
      porte: "Acima de 10 lojas",
    });
  });

  it("o porte pedido pelo nome ganha da inferência", () => {
    expect(estimarFaixa(TABELA, { porteId: "grande", lojas: 1 })).toMatchObject(
      { porte: "Acima de 10 lojas" },
    );
  });

  it("porte inexistente cai na inferência em vez de quebrar", () => {
    expect(
      estimarFaixa(TABELA, { porteId: "gigante", lojas: 1 }),
    ).toMatchObject({ porte: "Até 2 lojas" });
  });
});

describe("estimarFaixa — a janela de sanidade", () => {
  // O porte de cima é plano (`lojasAte: null`, sem cobrança por loja extra), e
  // por isso nunca estoura sozinho. Quem estoura é um porte com teto recebendo
  // uma operação grande demais — que é justamente o erro de preenchimento que
  // a janela existe para conter.
  it("nenhuma combinação absurda passa do teto", () => {
    const e = estimarFaixa(TABELA, {
      porteId: "medio",
      lojas: 5_000,
      toolIds: ["pdv", "estoque", "tracking"],
    });
    if (!e.disponivel) throw new Error("deveria estar disponível");
    expect(e.maxCents).toBeLessThanOrEqual(900_000);
    expect(e.minCents).toBeGreaterThanOrEqual(50_000);
    expect(e.memoria.some((linha) => linha.includes("teto"))).toBe(true);
  });

  it("varre combinações e nenhuma escapa da janela", () => {
    const ids = ["pdv", "estoque", "tracking"];
    for (const porteId of ["pequeno", "medio", "grande"]) {
      for (const lojas of [0, 1, 3, 12, 400]) {
        for (let mascara = 0; mascara < 8; mascara++) {
          const toolIds = ids.filter((_, i) => mascara & (1 << i));
          const e = estimarFaixa(TABELA, { porteId, lojas, toolIds });
          if (!e.disponivel) throw new Error("deveria estar disponível");
          expect(e.minCents).toBeGreaterThanOrEqual(50_000);
          expect(e.maxCents).toBeLessThanOrEqual(900_000);
          expect(e.maxCents).toBeGreaterThanOrEqual(e.minCents);
        }
      }
    }
  });

  it("teto zerado significa sem teto, não faixa zerada", () => {
    const semTeto = astroPricingSchema.parse({
      ...TABELA,
      teto: { minCents: 0, maxCents: 0 },
    });
    const e = estimarFaixa(semTeto, { porteId: "medio", lojas: 100 });
    if (!e.disponivel) throw new Error("deveria estar disponível");
    expect(e.maxCents).toBeGreaterThan(900_000);
  });
});

describe("a frase que o modelo repete", () => {
  it("vem pronta, com instrução de não reescrever", () => {
    const e = estimarFaixa(TABELA, { lojas: 1 });
    if (!e.disponivel) throw new Error("deveria estar disponível");
    expect(e.faixa).toMatch(/^R\$ [\d.]+ a R\$ [\d.]+ por mês$/);
    expect(e.instrucao).toContain("Repita a faixa exatamente");
    expect(e.disclaimer).toBe("Estimativa inicial.");
  });

  it("mínimo igual ao máximo vira valor único, não 'X a X'", () => {
    const fixa = astroPricingSchema.parse({
      ativo: true,
      portes: [
        {
          id: "u",
          label: "Único",
          lojasAte: null,
          usuariosAte: null,
          baseMinCents: 99_000,
          baseMaxCents: 99_000,
        },
      ],
    });
    const e = estimarFaixa(fixa, {});
    if (!e.disponivel) throw new Error("deveria estar disponível");
    expect(e.faixa).toBe("R$ 990 por mês");
  });

  it("o setup só aparece quando está cadastrado", () => {
    const e = estimarFaixa(TABELA, { lojas: 1 });
    if (!e.disponivel) throw new Error("deveria estar disponível");
    expect(e.setup).toBe("R$ 1.500 a R$ 4.000 — pago uma vez");

    const semSetup = astroPricingSchema.parse({
      ...TABELA,
      setup: { minCents: 0, maxCents: 0, texto: "" },
    });
    const sem = estimarFaixa(semSetup, { lojas: 1 });
    if (!sem.disponivel) throw new Error("deveria estar disponível");
    expect(sem.setup).toBeNull();
  });
});

describe("formatarCents", () => {
  it("arredonda para cima, para não prometer menos do que custa", () => {
    expect(formatarCents(89_050)).toBe("R$ 891");
    expect(formatarCents(89_000)).toBe("R$ 890");
  });
});

describe("lerTabelaDePrecos", () => {
  it("valor fora de formato vira tabela desligada em vez de erro", () => {
    expect(lerTabelaDePrecos(null).ativo).toBe(false);
    expect(lerTabelaDePrecos("qualquer coisa").ativo).toBe(false);
    expect(lerTabelaDePrecos({ ativo: "sim" }).ativo).toBe(false);
  });

  it("lê a tabela boa de volta inteira", () => {
    expect(lerTabelaDePrecos(TABELA).portes).toHaveLength(3);
  });
});
