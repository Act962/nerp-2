import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorScreen } from "./error-screen";

function erroDe(message: string, digest?: string) {
  return Object.assign(new Error(message), { digest });
}

describe("ErrorScreen", () => {
  // O ponto da tela: trocar "a client-side exception has occurred" por algo
  // que o operador consiga ler ao suporte.
  it("mostra a mensagem real e o digest", () => {
    render(
      <ErrorScreen
        error={erroDe("Cannot read properties of undefined", "a1b2c3")}
      />,
    );

    expect(
      screen.getByText("Cannot read properties of undefined"),
    ).toBeInTheDocument();
    expect(screen.getByText(/digest: a1b2c3/)).toBeInTheDocument();
  });

  it("não deixa a tela sem texto quando o erro não tem mensagem", () => {
    render(<ErrorScreen error={erroDe("")} />);

    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("oferece tentar de novo quando há reset", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<ErrorScreen error={erroDe("falhou")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: /Tentar de novo/ }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("omite tentar de novo quando não há reset", () => {
    render(<ErrorScreen error={erroDe("falhou")} />);

    expect(
      screen.queryByRole("button", { name: /Tentar de novo/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Recarregar/ }),
    ).toBeInTheDocument();
  });

  it("explica o caso de deploy quando o erro é de chunk", () => {
    const chunk = erroDe("Loading chunk 429 failed.");
    render(<ErrorScreen error={chunk} />);

    // Ou já entrou no estado de recarregar, ou explica o motivo — nos dois
    // casos o operador não fica com tela branca sem contexto.
    const atualizando = screen.queryByText(/Atualizando para a versão nova/);
    const explicacao = screen.queryByText(
      /atualizado enquanto esta aba estava aberta/,
    );
    expect(atualizando ?? explicacao).toBeTruthy();
  });
});
