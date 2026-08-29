import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PriceMetrics } from "./price-metrics";

const onSalePriceChange = vi.fn();

// Exemplo canônico do domínio: custo 12, venda 15 → lucro 3, margem 20%,
// markup 25%. Os três campos são editáveis e todos recalculam a VENDA.
function renderMetrics(
  props: Partial<React.ComponentProps<typeof PriceMetrics>> = {},
) {
  return render(
    <PriceMetrics
      costPrice={12}
      salePrice={15}
      onSalePriceChange={onSalePriceChange}
      {...props}
    />,
  );
}

const lucro = () => screen.getByLabelText("Lucro (R$)");
const margem = () => screen.getByLabelText("Margem sobre a venda (%)");
const markup = () => screen.getByLabelText("Markup sobre o custo (%)");

describe("PriceMetrics", () => {
  beforeEach(() => onSalePriceChange.mockClear());

  it("mostra os três derivados do custo e da venda", () => {
    renderMetrics();

    expect(lucro()).toHaveValue(3);
    expect(margem()).toHaveValue(20);
    expect(markup()).toHaveValue(25);
  });

  it("digitar markup recalcula o preço de venda", async () => {
    const user = userEvent.setup();
    renderMetrics();

    await user.clear(markup());
    await user.type(markup(), "25");

    expect(onSalePriceChange).toHaveBeenLastCalledWith(15);
  });

  it("digitar margem recalcula o preço de venda", async () => {
    const user = userEvent.setup();
    renderMetrics();

    await user.clear(margem());
    await user.type(margem(), "20");

    expect(onSalePriceChange).toHaveBeenLastCalledWith(15);
  });

  it("digitar lucro recalcula o preço de venda", async () => {
    const user = userEvent.setup();
    renderMetrics();

    await user.clear(lucro());
    await user.type(lucro(), "3");

    expect(onSalePriceChange).toHaveBeenLastCalledWith(15);
  });

  // Margem é fatia da própria venda: 100% exigiria preço infinito. Melhor não
  // mexer no preço do que gravar um absurdo.
  it("ignora margem de 100% em vez de gravar preço absurdo", async () => {
    const user = userEvent.setup();
    renderMetrics();

    await user.clear(margem());
    await user.type(margem(), "100");

    expect(onSalePriceChange).not.toHaveBeenCalledWith(
      Number.POSITIVE_INFINITY,
    );
    const chamadas = onSalePriceChange.mock.calls.map((c) => c[0]);
    expect(chamadas.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("desabilita markup enquanto não há custo", () => {
    renderMetrics({ costPrice: 0 });

    expect(markup()).toBeDisabled();
    expect(screen.getByText("Informe o custo primeiro")).toBeInTheDocument();
  });

  it("sem callback, os três viram somente leitura", () => {
    render(<PriceMetrics costPrice={12} salePrice={15} />);

    expect(lucro()).toBeDisabled();
    expect(margem()).toBeDisabled();
    expect(markup()).toBeDisabled();
  });

  it("preserva o que está sendo digitado sem arredondar no meio", async () => {
    const user = userEvent.setup();
    renderMetrics();

    await user.clear(margem());
    await user.type(margem(), "33.333");

    // O valor volta arredondado do preço; o campo tem que manter o texto cru.
    expect(margem()).toHaveValue(33.333);
  });
});
