import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ default: {} }));

const { LIMITES_A_PARTIR_DE, resolverPlano } = await import(
  "./plano-da-organizacao"
);

describe("resolverPlano", () => {
  const antes = new Date(LIMITES_A_PARTIR_DE.getTime() - 1);
  const depois = new Date(LIMITES_A_PARTIR_DE.getTime() + 1);

  it("organização anterior ao corte é legado, sem limites", () => {
    const { plano, origem } = resolverPlano({
      createdAt: antes,
      assinatura: null,
    });
    expect(origem).toBe("legado");
    expect(plano.limites.produtos).toBeNull();
  });

  it("organização nova é Grátis", () => {
    const { plano, origem } = resolverPlano({
      createdAt: depois,
      assinatura: null,
    });
    expect(origem).toBe("gratis");
    expect(plano.id).toBe("suit");
  });

  it("assinatura de plano pago passa na frente do corte", () => {
    const { plano, origem } = resolverPlano({
      createdAt: antes,
      assinatura: "earth",
    });
    expect(origem).toBe("assinatura");
    expect(plano.id).toBe("earth");
  });

  it("plano definido pelo admin vale para organização nova", () => {
    const { plano, origem } = resolverPlano({
      createdAt: depois,
      assinatura: null,
      planoDefinidoPeloAdmin: "explore",
    });
    expect(origem).toBe("admin");
    expect(plano.limites.produtos).toBeNull();
  });

  it("assinatura passa na frente do plano definido pelo admin", () => {
    const { plano, origem } = resolverPlano({
      createdAt: depois,
      assinatura: "constellation",
      planoDefinidoPeloAdmin: "earth",
    });
    expect(origem).toBe("assinatura");
    expect(plano.id).toBe("constellation");
  });

  it("plano do admin desconhecido cai na regra automática", () => {
    const { origem } = resolverPlano({
      createdAt: depois,
      assinatura: null,
      planoDefinidoPeloAdmin: "nao-existe",
    });
    expect(origem).toBe("gratis");
  });

  it("assinatura de plano desconhecido é ignorada", () => {
    const { origem } = resolverPlano({
      createdAt: depois,
      assinatura: "nao-existe",
    });
    expect(origem).toBe("gratis");
  });
});
