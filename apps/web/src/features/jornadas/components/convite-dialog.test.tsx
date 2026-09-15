import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConviteDialog, type JornadaDoConvite } from "./convite-dialog";

// O mascote vem do pacote do widget, que importa o CSS dele — e CSS do
// Tailwind não passa pelo PostCSS dentro do jsdom. Ele não é o que está sob
// teste aqui.
vi.mock("@nerp/astro-widget", () => ({
  AstroMark: ({ className }: { className?: string }) => (
    <span className={className} data-testid="astro-mark" />
  ),
}));

const iniciar = vi.fn(async () => ({
  iniciadaEm: "2026-09-12T10:00:00.000Z",
  concluida: false,
}));
const comecar = vi.fn();

// Mockando o hook da feature, não o `orpc`: é o que mantém a árvore do
// servidor fora do jsdom.
vi.mock("../hooks/use-jornadas", () => ({
  useIniciarJornada: () => ({ mutateAsync: iniciar, isPending: false }),
}));

vi.mock("../hooks/use-jornada-store", () => ({
  useJornadaStore: (seletor: (estado: unknown) => unknown) =>
    seletor({ comecar }),
}));

const JORNADA: JornadaDoConvite = {
  id: "produtos-cadastro",
  titulo: "Cadastre o seu primeiro produto",
  descricao: "Buscar, cadastrar e organizar em categorias.",
  totalPassos: 9,
  minutos: 4,
  stars: 10,
  recompensaDaOrg: { creditada: false, porNome: null },
};

function montar(jornada: JornadaDoConvite = JORNADA) {
  const aoFechar = vi.fn();
  render(
    <ConviteDialog
      jornada={jornada}
      organizationId="org_1"
      aberto
      aoFechar={aoFechar}
    />,
  );
  return { aoFechar };
}

describe("ConviteDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("diz o que a jornada custa de tempo e o que ela paga", () => {
    montar();
    expect(screen.getByText("9 passos")).toBeInTheDocument();
    expect(screen.getByText("~4 min")).toBeInTheDocument();
    expect(screen.getByText("10 ★")).toBeInTheDocument();
  });

  it("avisa a regra das ★ ANTES de começar", () => {
    montar();
    expect(
      screen.getByText("Só ganha quem faz passo a passo"),
    ).toBeInTheDocument();
  });

  it("quando um colega já resgatou, diz quem foi e não promete ★", () => {
    montar({
      ...JORNADA,
      recompensaDaOrg: { creditada: true, porNome: "Ana" },
    });
    expect(screen.getByText(/Ana já garantiu as ★/)).toBeInTheDocument();
    expect(
      screen.queryByText("Só ganha quem faz passo a passo"),
    ).not.toBeInTheDocument();
  });

  it("Começar inicia no servidor e só então liga o motor", async () => {
    const usuario = userEvent.setup();
    const { aoFechar } = montar();

    await usuario.click(screen.getByRole("button", { name: "Começar" }));

    expect(iniciar).toHaveBeenCalledWith({ jornadaId: "produtos-cadastro" });
    expect(comecar).toHaveBeenCalledWith({
      jornadaId: "produtos-cadastro",
      organizationId: "org_1",
      // O relógio é o do servidor: é contra ele que a pressa é medida.
      iniciadaEm: "2026-09-12T10:00:00.000Z",
    });
    expect(aoFechar).toHaveBeenCalled();
  });

  it("Agora não fecha sem começar nada", async () => {
    const usuario = userEvent.setup();
    const { aoFechar } = montar();

    await usuario.click(screen.getByRole("button", { name: "Agora não" }));

    expect(comecar).not.toHaveBeenCalled();
    expect(aoFechar).toHaveBeenCalled();
  });
});
