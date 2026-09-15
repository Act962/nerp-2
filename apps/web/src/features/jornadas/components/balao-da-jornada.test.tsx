import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Passo } from "../catalogo/tipos";
import { BalaoDaJornada } from "./balao-da-jornada";

// O mascote vem do pacote do widget, que importa o CSS dele — e CSS do
// Tailwind não passa pelo PostCSS dentro do jsdom. Ele não é o que está sob
// teste aqui.
vi.mock("@nerp/astro-widget", () => ({
  AstroMark: ({ className }: { className?: string }) => (
    <span className={className} data-testid="astro-mark" />
  ),
}));

const PASSO: Passo = {
  tipo: "ler",
  alvo: "a",
  titulo: "Este é o seu painel",
  texto: "Tudo o que a operação fez hoje aparece aqui.",
};

function montar(passo: Passo = PASSO, extras: { falaDePressa?: boolean } = {}) {
  const aoAvancar = vi.fn();
  const aoFechar = vi.fn();
  render(
    <BalaoDaJornada
      passo={passo}
      indice={2}
      total={5}
      falaDePressa={extras.falaDePressa ?? false}
      podeAvancar={passo.tipo === "ler"}
      aoAvancar={aoAvancar}
      aoFechar={aoFechar}
    />,
  );
  return { aoAvancar, aoFechar };
}

describe("BalaoDaJornada", () => {
  it("mostra o passo e onde a pessoa está na jornada", () => {
    montar();
    expect(screen.getByText("Este é o seu painel")).toBeInTheDocument();
    expect(screen.getByText("Passo 3 de 5")).toBeInTheDocument();
  });

  it("sem a fala ligada, o balão não cobra nada de ninguém", () => {
    montar();
    expect(screen.queryByText(/tá com pressa/)).not.toBeInTheDocument();
  });

  it("com a fala ligada, o Astro avisa sobre as ★", () => {
    montar(PASSO, { falaDePressa: true });
    expect(
      screen.getByText(/Tá ligado que eu sei que tá com pressa/),
    ).toBeInTheDocument();
  });

  it("passo de clique não oferece Próximo — a prova ali é o clique", () => {
    montar({ ...PASSO, tipo: "clicar" });
    expect(
      screen.queryByRole("button", { name: "Próximo" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Clique no que está destacado"),
    ).toBeInTheDocument();
  });

  it("Fechar instrução sempre existe, em qualquer tipo de passo", async () => {
    const usuario = userEvent.setup();
    const { aoFechar } = montar({ ...PASSO, tipo: "digitar" });

    await usuario.click(
      screen.getByRole("button", { name: "Fechar instrução" }),
    );
    expect(aoFechar).toHaveBeenCalled();
  });

  it("Próximo avisa o motor", async () => {
    const usuario = userEvent.setup();
    const { aoAvancar } = montar();

    await usuario.click(screen.getByRole("button", { name: "Próximo" }));
    expect(aoAvancar).toHaveBeenCalled();
  });
});
