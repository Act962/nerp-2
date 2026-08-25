import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O componente conversa com o servidor SÓ pelo hook da feature — é essa a
// costura que o teste substitui. Mockar aqui também evita que `@/lib/orpc`
// (e, por trás dele, o router inteiro com Prisma) seja carregado no jsdom.
const mutate = vi.fn();
vi.mock("../hooks/use-supplier", () => ({
  useCreateSupplier: () => ({ mutate, isPending: false }),
}));

import { Button } from "@/components/ui/button";
import { AddSupplierModal } from "./add-supplier";

// Molde para componente de formulário: o padrão canônico de forms do projeto
// (react-hook-form + zodResolver + Controller + Field/FieldError).
describe("AddSupplierModal", () => {
  beforeEach(() => {
    mutate.mockClear();
  });

  async function abrirModal() {
    const user = userEvent.setup();
    render(
      <AddSupplierModal>
        <Button>Novo fornecedor</Button>
      </AddSupplierModal>,
    );
    await user.click(screen.getByRole("button", { name: "Novo fornecedor" }));
    await screen.findByRole("dialog");
    return user;
  }

  it("bloqueia o envio e mostra o erro do zod quando o nome é curto demais", async () => {
    const user = await abrirModal();

    await user.type(screen.getByLabelText("Razão Social / Nome"), "ab");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Nome deve ter pelo menos 3 caracteres"),
    ).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("envia o formulário com os dados preenchidos", async () => {
    const user = await abrirModal();

    await user.type(
      screen.getByLabelText("Razão Social / Nome"),
      "Indústria Teste",
    );
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      name: "Indústria Teste",
      personType: "JURIDICA",
    });
  });
});
