import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MelhoriasDialog } from "./melhorias-dialog";

const enviarMutate = vi.fn(async () => ({ id: "mel_1" }));
const capturar = vi.fn(
  async () => new File(["x"], "tela.png", { type: "image/png" }),
);
const subir = vi.fn(
  async (_arquivo: File, _pasta: string) =>
    "https://bucket/org_1/melhorias/tela.png",
);

vi.mock("../hooks/use-jornadas", () => ({
  useEnviarMelhoria: () => ({ mutateAsync: enviarMutate, isPending: false }),
}));
vi.mock("../lib/capturar-tela", () => ({ capturarTela: () => capturar() }));
vi.mock("../lib/subir-imagem", () => ({
  subirImagem: (a: File, p: string) => subir(a, p),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/vendas/novo" }));

describe("MelhoriasDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:previa");
    URL.revokeObjectURL = vi.fn();
  });

  it("texto curto demais não envia — pedido de uma palavra não é acionável", async () => {
    render(<MelhoriasDialog aberto aoFechar={vi.fn()} />);
    const usuario = userEvent.setup();

    await usuario.type(screen.getByLabelText("Sua sugestão"), "pequeno");

    expect(screen.getByRole("button", { name: /Enviar/ })).toBeDisabled();
  });

  it("envia o pedido com a tela em que a pessoa está", async () => {
    const aoFechar = vi.fn();
    render(<MelhoriasDialog aberto aoFechar={aoFechar} />);
    const usuario = userEvent.setup();

    await usuario.type(
      screen.getByLabelText("Sua sugestão"),
      "Queria buscar produto pelo fornecedor também",
    );
    await usuario.click(screen.getByRole("button", { name: /Enviar/ }));

    expect(enviarMutate).toHaveBeenCalledWith({
      pathname: "/vendas/novo",
      mensagem: "Queria buscar produto pelo fornecedor também",
      imagens: [],
    });
    expect(aoFechar).toHaveBeenCalled();
  });

  it("capturar a tela vira uma miniatura anexada", async () => {
    render(<MelhoriasDialog aberto aoFechar={vi.fn()} />);
    const usuario = userEvent.setup();

    await usuario.click(
      screen.getByRole("button", { name: /Capturar esta tela/ }),
    );

    expect(capturar).toHaveBeenCalled();
    expect(await screen.findByAltText("Anexo 1")).toBeInTheDocument();
    expect(screen.getByText(/1\/4/)).toBeInTheDocument();
  });

  it("a imagem só sobe no envio, não ao escolher", async () => {
    render(<MelhoriasDialog aberto aoFechar={vi.fn()} />);
    const usuario = userEvent.setup();

    await usuario.click(
      screen.getByRole("button", { name: /Capturar esta tela/ }),
    );
    expect(subir).not.toHaveBeenCalled();

    await usuario.type(
      screen.getByLabelText("Sua sugestão"),
      "O botão de finalizar some no celular",
    );
    await usuario.click(screen.getByRole("button", { name: /Enviar/ }));

    expect(subir).toHaveBeenCalledWith(expect.any(File), "melhorias");
    expect(enviarMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        imagens: ["https://bucket/org_1/melhorias/tela.png"],
      }),
    );
  });
});
