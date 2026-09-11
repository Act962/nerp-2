import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * A tela de preço.
 *
 * O que se garante aqui é o que dói descobrir em produção: um plano que ainda
 * não existe no Stripe oferecendo "Escolher", e um comparativo com número
 * quando a tabela de preço nem foi cadastrada — que seria uma promessa
 * comercial inventada.
 *
 * Os dois hooks da feature são dublados, como manda a convenção: é o que
 * mantém `@/lib/orpc` — e o servidor inteiro atrás dele — fora do jsdom.
 */

const useSaldo = vi.hoisted(() => vi.fn());
const usePrecosAvulsos = vi.hoisted(() => vi.fn());

vi.mock("@/features/stars/hooks/use-stars", () => ({ useSaldo }));
vi.mock("../hooks/use-precos-avulsos", () => ({ usePrecosAvulsos }));

const { Planos } = await import("./planos");

function montar(opcoes: {
  planoAtual?: string;
  avulsos?: {
    ativo: boolean;
    modulos: { toolId: string; minCents: number; maxCents: number }[];
  };
}) {
  useSaldo.mockReturnValue({
    data: opcoes.planoAtual ? { plano: { id: opcoes.planoAtual } } : undefined,
  });
  usePrecosAvulsos.mockReturnValue({ data: opcoes.avulsos });
  render(<Planos />);
}

describe("tela de planos", () => {
  it("mostra os quatro planos com os nomes do catálogo", () => {
    montar({});
    for (const nome of ["Suit", "Earth", "Explore", "Constellation"]) {
      expect(screen.getByText(nome)).toBeInTheDocument();
    }
  });

  it("plano sem priceId aparece como 'Em breve', e não como 'Escolher'", () => {
    // Enquanto o Stripe não estiver plugado, oferecer o botão levaria a pessoa
    // a um caminho que não existe.
    montar({});
    expect(screen.getAllByRole("button", { name: "Em breve" })).toHaveLength(3);
    for (const botao of screen.getAllByRole("button", { name: "Em breve" })) {
      expect(botao).toBeDisabled();
    }
  });

  it("o plano atual não oferece botão de troca", () => {
    montar({ planoAtual: "suit" });
    expect(
      screen.getByRole("button", { name: "Você está aqui" }),
    ).toBeDisabled();
  });

  it("marca o mais popular", () => {
    montar({});
    expect(screen.getByText("Mais popular")).toBeInTheDocument();
  });

  it("sem tabela de preço, NENHUM número de comparativo aparece", () => {
    montar({});
    expect(screen.queryByText(/Contratando as/)).toBeNull();
    expect(screen.queryByText(/mais barato/)).toBeNull();
  });

  it("tabela desligada também não mostra comparativo", () => {
    montar({
      avulsos: {
        ativo: false,
        modulos: [{ toolId: "pdv", minCents: 30_000, maxCents: 50_000 }],
      },
    });
    expect(screen.queryByText(/mais barato/)).toBeNull();
  });

  it("com tabela, mostra o comparativo e a economia", () => {
    montar({
      avulsos: {
        ativo: true,
        modulos: [
          { toolId: "pdv", minCents: 30_000, maxCents: 50_000 },
          { toolId: "whatsapp", minCents: 20_000, maxCents: 40_000 },
        ],
      },
    });
    // O cabeçalho diz a soma; o card diz a economia. São frases diferentes.
    expect(
      screen.getByText(/Contratando as 2 ferramentas/),
    ).toBeInTheDocument();
    // R$ 500 no piso contra R$ 197 do Earth: 61%.
    expect(screen.getByText(/61% mais barato/)).toBeInTheDocument();
  });

  it("o preço anual aparece em todo plano pago, e não no grátis", () => {
    montar({});
    expect(screen.getAllByText(/por ano — dois meses sem pagar/)).toHaveLength(
      3,
    );
  });

  it("lojas ilimitadas concorda em gênero", () => {
    montar({});
    expect(screen.getByText("lojas ilimitadas")).toBeInTheDocument();
  });
});
