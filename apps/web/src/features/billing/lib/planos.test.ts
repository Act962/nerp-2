import { describe, expect, it } from "vitest";
import {
  formatarPrecoDoPlano,
  limiteDeStars,
  limiteDoRecurso,
  PLANO_GRATIS,
  PLANO_LEGADO,
  PLANOS,
  planoPorId,
  planosParaBetterAuth,
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
    expect(ids[0]).toBe("gratis");
  });

  it("planoPorId acha catálogo e legado, e nada mais", () => {
    expect(planoPorId("gratis")).toBe(PLANO_GRATIS);
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
