import { ASTRO_PAGINA_VAZIA, type AstroPagina } from "@nerp/site-content";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SitePageAstro } from "./site-page-astro";

/**
 * O campo de palavras-chave já teve um defeito que só aparece digitando: sendo
 * controlado pela lista (`join(", ")`), a vírgula recém-digitada sumia no mesmo
 * instante — ela criava um item vazio, o filtro descartava, e o join devolvia
 * o texto sem ela. Nunca dava para escrever a segunda palavra.
 */

/** O pai de verdade guarda o estado; sem isso o teste não vê o campo evoluir. */
function ComEstado({
  inicial = ASTRO_PAGINA_VAZIA,
  aoMudar,
}: {
  inicial?: AstroPagina;
  aoMudar?: (proximo: AstroPagina) => void;
}) {
  const [valor, setValor] = useState(inicial);
  return (
    <SitePageAstro
      valor={valor}
      onChange={(proximo) => {
        setValor(proximo);
        aoMudar?.(proximo);
      }}
    />
  );
}

describe("SitePageAstro — palavras-chave", () => {
  it("deixa digitar várias separadas por vírgula", async () => {
    const user = userEvent.setup();
    render(<ComEstado />);

    const campo = screen.getByLabelText("Palavras-chave");
    await user.type(campo, "funil, kanban, lead");

    // O que está na tela é exatamente o que foi digitado — vírgulas inclusive.
    expect(campo).toHaveValue("funil, kanban, lead");
  });

  it("só vira lista ao sair do campo", async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<ComEstado aoMudar={aoMudar} />);

    const campo = screen.getByLabelText("Palavras-chave");
    await user.type(campo, "funil, kanban");
    await user.tab();

    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
    const ultimo = aoMudar.mock.calls.at(-1)?.[0] as AstroPagina;
    expect(ultimo.palavrasChave).toEqual(["funil", "kanban"]);
  });

  it("limpa espaço sobrando e vírgula pendurada", async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<ComEstado aoMudar={aoMudar} />);

    await user.type(screen.getByLabelText("Palavras-chave"), " pdv ,, caixa, ");
    await user.tab();

    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
    const ultimo = aoMudar.mock.calls.at(-1)?.[0] as AstroPagina;
    expect(ultimo.palavrasChave).toEqual(["pdv", "caixa"]);
  });

  it("mostra o que já estava salvo", () => {
    render(
      <ComEstado
        inicial={{ ...ASTRO_PAGINA_VAZIA, palavrasChave: ["funil", "lead"] }}
      />,
    );
    expect(screen.getByLabelText("Palavras-chave")).toHaveValue("funil, lead");
  });
});

describe("SitePageAstro — balões", () => {
  it("adiciona e escreve uma fala", async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<ComEstado aoMudar={aoMudar} />);

    await user.click(screen.getByRole("button", { name: "Adicionar balão" }));
    await user.type(screen.getByPlaceholderText("Essa é top hein"), "Opa!");

    const ultimo = aoMudar.mock.calls.at(-1)?.[0] as AstroPagina;
    expect(ultimo.baloes).toEqual(["Opa!"]);
  });

  it("para de oferecer o botão no quarto balão", async () => {
    render(
      <ComEstado
        inicial={{ ...ASTRO_PAGINA_VAZIA, baloes: ["a", "b", "c", "d"] }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Adicionar balão" }),
    ).not.toBeInTheDocument();
  });
});
