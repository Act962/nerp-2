import { describe, expect, it } from "vitest";
import {
  formatarPrecoDoPlano,
  limiteDeStars,
  limiteDoRecurso,
  MESES_PAGOS_NO_ANUAL,
  PLANO_EM_DESTAQUE,
  PLANO_GRATIS,
  PLANO_LEGADO,
  PLANOS,
  planoPorId,
  planosParaBetterAuth,
  precoAnualCentavos,
} from "./planos";

describe("catálogo de planos", () => {
  it("o Grátis dá 50 ★ uma vez e limita cadastros", () => {
    expect(PLANO_GRATIS.starsBoasVindas).toBe(50);
    expect(PLANO_GRATIS.limites.starsPorCiclo).toBe(0);
    expect(limiteDeStars(PLANO_GRATIS)).toBe(50);
    expect(limiteDoRecurso(PLANO_GRATIS, "produtos")).toBe(10);
    expect(limiteDoRecurso(PLANO_GRATIS, "membros")).toBe(2);
  });

  it("o legado não limita nada e não dá ★", () => {
    expect(limiteDoRecurso(PLANO_LEGADO, "produtos")).toBeNull();
    expect(limiteDeStars(PLANO_LEGADO)).toBe(0);
    expect(PLANOS.map((plano) => plano.id)).not.toContain(PLANO_LEGADO.id);
  });

  it("ids são únicos e o Grátis vem primeiro", () => {
    const ids = PLANOS.map((plano) => plano.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("suit");
  });

  it("planoPorId acha catálogo e legado, e nada mais", () => {
    expect(planoPorId("suit")).toBe(PLANO_GRATIS);
    expect(planoPorId("legado")).toBe(PLANO_LEGADO);
    expect(planoPorId("inexistente")).toBeNull();
  });

  it("só plano com priceId vai para o Better Auth", () => {
    const paraPlugin = planosParaBetterAuth();
    for (const plano of paraPlugin) {
      expect(plano.priceId).toBeTruthy();
      expect(plano.name).not.toBe("gratis");
    }
    // Enquanto os slots pagos não têm priceId, a lista é vazia — e isso é
    // correto: plano sem preço no Stripe não pode ser assinado.
    const comPreco = PLANOS.filter((plano) => plano.priceId !== null);
    expect(paraPlugin).toHaveLength(comPreco.length);
  });

  it("formata preço", () => {
    expect(formatarPrecoDoPlano(null)).toBe("Em breve");
    expect(formatarPrecoDoPlano(0)).toBe("Grátis");
    expect(formatarPrecoDoPlano(14990)).toMatch(/149,90/);
  });
});

/**
 * As travas do catálogo comercial.
 *
 * Um erro aqui não quebra teste nenhum do sistema: aparece na fatura, no fim
 * do mês, ou na tela de um cliente que escolheu um plano que não existe.
 */
describe("catálogo comercial", () => {
  it("são quatro planos, do grátis ao topo, em ordem de preço", () => {
    expect(PLANOS.map((p) => p.id)).toEqual([
      "suit",
      "earth",
      "explore",
      "constellation",
    ]);
    const precos = PLANOS.map((p) => p.precoCentavos ?? 0);
    for (let i = 1; i < precos.length; i++) {
      expect(precos[i], PLANOS[i].id).toBeGreaterThan(precos[i - 1]);
    }
  });

  it("todo plano pago tem preço, e o grátis é zero", () => {
    for (const plano of PLANOS) {
      if (plano.gratuito) {
        expect(plano.precoCentavos, plano.id).toBe(0);
      } else {
        expect(plano.precoCentavos, plano.id).toBeGreaterThan(0);
      }
    }
  });

  it("a cota de ★ nunca vale mais que a mensalidade", () => {
    // É a trava que impede o prejuízo silencioso: a ★ sai por ~R$ 0,10 no
    // pacote pequeno, então uma cota generosa demais custa mais que o plano
    // rende — e ninguém percebe até a conta do provedor chegar.
    const CENTAVOS_POR_ESTRELA = 9.98;
    for (const plano of PLANOS) {
      const mensalidade = plano.precoCentavos ?? 0;
      if (mensalidade === 0) continue;
      const cota = plano.limites.starsPorCiclo * CENTAVOS_POR_ESTRELA;
      expect(cota, plano.id).toBeLessThan(mensalidade);
    }
  });

  it("o destaque aponta para um plano que existe e é pago", () => {
    const destaque = PLANOS.find((p) => p.id === PLANO_EM_DESTAQUE);
    expect(destaque).toBeDefined();
    expect(destaque?.gratuito).toBe(false);
  });

  it("o anual cobra dez meses e entrega doze", () => {
    const earth = PLANOS.find((p) => p.id === "earth");
    expect(earth).toBeDefined();
    if (!earth) return;
    expect(precoAnualCentavos(earth)).toBe(
      (earth.precoCentavos ?? 0) * MESES_PAGOS_NO_ANUAL,
    );
    expect(MESES_PAGOS_NO_ANUAL).toBeLessThan(12);
  });

  it("o grátis não tem preço anual", () => {
    const suit = PLANOS.find((p) => p.gratuito);
    expect(suit).toBeDefined();
    if (suit) expect(precoAnualCentavos(suit)).toBeNull();
  });

  it("plano pago dá ★ por ciclo; o grátis dá só as de boas-vindas", () => {
    for (const plano of PLANOS) {
      if (plano.gratuito) {
        expect(plano.limites.starsPorCiclo, plano.id).toBe(0);
        expect(plano.starsBoasVindas, plano.id).toBeGreaterThan(0);
      } else {
        expect(plano.limites.starsPorCiclo, plano.id).toBeGreaterThan(0);
      }
    }
  });
});
