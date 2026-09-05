import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { astroPricingSchema } from "@/features/astro-consultor/server/preco";

// A tela fala com o servidor só pelos hooks da feature — é essa costura que o
// teste substitui. Mockar aqui também mantém `@/lib/orpc`, e o router inteiro
// atrás dele, fora do jsdom.
const salvarPricing = vi.fn();
const salvarConfig = vi.fn();
const simular = vi.fn();

const TABELA = astroPricingSchema.parse({
  ativo: true,
  portes: [
    {
      id: "pequeno",
      label: "Até 2 lojas",
      lojasAte: 2,
      usuariosAte: 10,
      baseMinCents: 89_000,
      baseMaxCents: 124_000,
    },
  ],
  modulos: [{ toolId: "pdv", minCents: 20_000, maxCents: 30_000 }],
});

vi.mock("../hooks/use-site-admin", () => ({
  useAstroPricing: () => ({
    pricing: TABELA,
    config: { ativo: true, tetoMensagensDia: 0, modelo: "" },
    isLoading: false,
  }),
  useSaveAstroPricing: () => ({ mutate: salvarPricing, isPending: false }),
  useSaveAstroConfig: () => ({ mutate: salvarConfig, isPending: false }),
  useSimularPreco: () => ({
    mutate: simular,
    isPending: false,
    data: undefined,
  }),
}));

import { SiteAstroPricing } from "./site-astro-pricing";

describe("SiteAstroPricing", () => {
  beforeEach(() => {
    salvarPricing.mockClear();
    salvarConfig.mockClear();
    simular.mockClear();
  });

  it("mostra a tabela cadastrada com os valores em reais", async () => {
    render(<SiteAstroPricing />);

    expect(await screen.findByDisplayValue("Até 2 lojas")).toBeInTheDocument();
    // 89.000 centavos são R$ 890 na tela — o campo é em reais, o banco em
    // centavos, e é esta conversão que um erro de 100× estragaria.
    expect(screen.getByDisplayValue("890")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1240")).toBeInTheDocument();
  });

  it("salva a tabela que está na tela", async () => {
    const user = userEvent.setup();
    render(<SiteAstroPricing />);

    await user.click(screen.getByRole("button", { name: "Salvar faixas" }));

    await waitFor(() => expect(salvarPricing).toHaveBeenCalledTimes(1));
    expect(salvarPricing.mock.calls[0][0].pricing.portes[0].label).toBe(
      "Até 2 lojas",
    );
  });

  it("simula sobre o rascunho, antes de salvar", async () => {
    const user = userEvent.setup();
    render(<SiteAstroPricing />);

    await user.click(screen.getByRole("button", { name: "Simular" }));

    await waitFor(() => expect(simular).toHaveBeenCalledTimes(1));
    expect(simular.mock.calls[0][0]).toMatchObject({ lojas: 3, usuarios: 12 });
    expect(salvarPricing).not.toHaveBeenCalled();
  });

  it("desligar as faixas não salva sozinho — é o botão que salva", async () => {
    const user = userEvent.setup();
    render(<SiteAstroPricing />);

    const interruptores = screen.getAllByRole("switch");
    // O segundo é "Falar de valores"; o primeiro liga o consultor.
    await user.click(interruptores[1]);
    expect(salvarPricing).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Salvar faixas" }));
    await waitFor(() => expect(salvarPricing).toHaveBeenCalled());
    expect(salvarPricing.mock.calls[0][0].pricing.ativo).toBe(false);
  });
});
