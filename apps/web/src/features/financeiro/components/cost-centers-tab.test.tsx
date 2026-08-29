import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// O componente só fala com o servidor pelos hooks da feature — é essa a
// costura que o teste substitui. Mockar aqui também mantém `@/lib/orpc` (e o
// router com Prisma atrás dele) fora do jsdom.
const listState: { data: unknown; isPending: boolean } = {
  data: { costCenters: [] },
  isPending: false,
};
const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

vi.mock("@/features/financeiro/hooks/use-financeiro", () => ({
  useCostCenters: () => listState,
  useCreateCostCenter: () => ({ mutate: createMutate, isPending: false }),
  useUpdateCostCenter: () => ({ mutate: updateMutate, isPending: false }),
  useDeleteCostCenter: () => ({ mutate: deleteMutate, isPending: false }),
}));

import { CostCentersTab } from "./cost-centers-tab";

const LOJA = {
  id: "cc1",
  name: "Loja Centro",
  description: "Vendas do balcão",
  isActive: true,
};
const FROTA = {
  id: "cc2",
  name: "Frota",
  description: null,
  isActive: false,
};

describe("CostCentersTab", () => {
  beforeEach(() => {
    createMutate.mockClear();
    updateMutate.mockClear();
    deleteMutate.mockClear();
    listState.data = { costCenters: [] };
    listState.isPending = false;
  });

  it("avisa quando não há nenhum cadastrado", () => {
    render(<CostCentersTab />);

    expect(
      screen.getByText("Nenhum centro de custo cadastrado."),
    ).toBeInTheDocument();
  });

  it("lista com descrição e status", () => {
    listState.data = { costCenters: [LOJA, FROTA] };
    render(<CostCentersTab />);

    expect(screen.getByText("Loja Centro")).toBeInTheDocument();
    expect(screen.getByText("Vendas do balcão")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
    // Sem descrição não deixa a célula vazia.
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("cria um novo centro de custo", async () => {
    const user = userEvent.setup();
    render(<CostCentersTab />);

    await user.click(screen.getByRole("button", { name: /Novo centro/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nome"), "Marketing");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Marketing" }),
      expect.anything(),
    );
  });

  it("não deixa criar sem nome", async () => {
    const user = userEvent.setup();
    render(<CostCentersTab />);

    await user.click(screen.getByRole("button", { name: /Novo centro/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(
      await within(dialog).findByText("Informe o nome"),
    ).toBeInTheDocument();
    expect(createMutate).not.toHaveBeenCalled();
  });

  // Criar já nasce ativo; o interruptor só faz sentido para desativar depois,
  // que é a alternativa a excluir quando já há lançamentos apontando.
  it("o interruptor Ativo só aparece na edição", async () => {
    const user = userEvent.setup();
    listState.data = { costCenters: [LOJA] };
    render(<CostCentersTab />);

    await user.click(screen.getByRole("button", { name: /Novo centro/ }));
    expect(
      within(await screen.findByRole("dialog")).queryByLabelText("Ativo"),
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(
      screen.getByRole("button", { name: "Editar Loja Centro" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Ativo")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nome")).toHaveValue("Loja Centro");
  });

  it("exclui pelo botão da linha", async () => {
    const user = userEvent.setup();
    listState.data = { costCenters: [LOJA] };
    render(<CostCentersTab />);

    await user.click(
      screen.getByRole("button", { name: "Excluir Loja Centro" }),
    );

    expect(deleteMutate).toHaveBeenCalledWith({ id: "cc1" });
  });
});
