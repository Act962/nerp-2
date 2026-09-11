import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * O diálogo que credita ★ na mão.
 *
 * O que se protege aqui é o caminho do erro caro: um valor digitado em pt-BR
 * ("0,5") que virasse `NaN` e creditasse zero em silêncio, e um crédito sem
 * motivo — que é a linha do extrato que ninguém explica depois.
 */

const mutate = vi.hoisted(() => vi.fn());
const useCreditarStars = vi.hoisted(() =>
  vi.fn(() => ({ mutate, isPending: false })),
);

vi.mock("../hooks/use-site-admin", () => ({ useCreditarStars }));

const { CreditarStarsDialog } = await import("./creditar-stars-dialog");

const EMPRESA = { id: "org_1", nome: "Mercado Gotham", saldo: 120 };

function abrir(onClose = vi.fn()) {
  render(<CreditarStarsDialog empresa={EMPRESA} onClose={onClose} />);
}

function digitar(rotulo: RegExp, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

beforeEach(() => {
  mutate.mockClear();
});

describe("creditar ★ pelo admin", () => {
  it("mostra o saldo de hoje da empresa", () => {
    abrir();
    expect(screen.getByText(/Mercado Gotham tem 120 ★/)).toBeInTheDocument();
  });

  it("aceita vírgula e envia o número", () => {
    abrir();
    digitar(/Quantas ★/, "0,5");
    digitar(/Motivo/, "Cortesia de avaliação");
    fireEvent.click(screen.getByRole("button", { name: "Creditar" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        organizationId: "org_1",
        valor: 0.5,
        motivo: "Cortesia de avaliação",
      },
      expect.anything(),
    );
  });

  it("antecipa o saldo que vai ficar", () => {
    abrir();
    digitar(/Quantas ★/, "80");
    expect(screen.getByText(/O saldo fica em 200 ★/)).toBeInTheDocument();
  });

  it("não envia sem motivo", () => {
    abrir();
    digitar(/Quantas ★/, "500");
    fireEvent.click(screen.getByRole("button", { name: "Creditar" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Diga o motivo do crédito.")).toBeInTheDocument();
  });

  it("não envia valor que não é número", () => {
    abrir();
    digitar(/Quantas ★/, "abc");
    digitar(/Motivo/, "Reembolso");
    fireEvent.click(screen.getByRole("button", { name: "Creditar" }));

    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText("Informe um número maior que zero."),
    ).toBeInTheDocument();
  });

  it("não envia zero — seria um crédito que não credita nada", () => {
    abrir();
    digitar(/Quantas ★/, "0");
    digitar(/Motivo/, "Reembolso");
    fireEvent.click(screen.getByRole("button", { name: "Creditar" }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("os atalhos preenchem o valor", () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: "+500" }));
    expect(screen.getByLabelText(/Quantas ★/)).toHaveValue("500");
  });

  it("cancelar fecha sem creditar", () => {
    const onClose = vi.fn();
    abrir(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});
