import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaixaStatusBadge } from "./caixa-status-badge";

// Molde para componente de apresentação: sem provider, sem mock, sem rede.
describe("CaixaStatusBadge", () => {
  it("mostra o estado fechado sem detalhes", () => {
    render(
      <CaixaStatusBadge
        open={false}
        registerName="Caixa 1"
        operatorName="Ana"
      />,
    );

    expect(screen.getByText("Caixa fechado")).toBeInTheDocument();
    expect(screen.queryByText(/Caixa 1/)).not.toBeInTheDocument();
  });

  it("mostra caixa e operador quando aberto", () => {
    render(<CaixaStatusBadge open registerName="Caixa 1" operatorName="Ana" />);

    expect(screen.getByText("Caixa aberto")).toBeInTheDocument();
    expect(screen.getByText("Caixa 1 · Ana")).toBeInTheDocument();
  });

  it("omite o separador quando só um dos dois nomes vem", () => {
    render(<CaixaStatusBadge open registerName="Caixa 1" />);

    expect(screen.getByText("Caixa 1")).toBeInTheDocument();
  });
});
