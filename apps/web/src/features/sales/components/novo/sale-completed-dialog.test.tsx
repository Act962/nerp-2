import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReceiptSaleData } from "@/features/receipt-designer/lib/types";

// O diálogo tem duas costuras com o mundo: o hook do template padrão (servidor)
// e o módulo de impressão (navegador). Mockar o hook mantém `@/lib/orpc` — e o
// router com Prisma atrás dele — fora do jsdom; mockar a impressão evita
// `window.print`, que o jsdom não implementa.
const templateQuery: { data: unknown; isPending: boolean } = {
  data: undefined,
  isPending: false,
};
vi.mock("@/features/receipt-designer/hooks/use-receipt-templates", () => ({
  useReceiptDefaultTemplate: () => templateQuery,
}));

const printSpy = vi.fn();
vi.mock("@/features/receipt-designer/components/receipt-print", () => ({
  triggerReceiptPrint: (paper: unknown) => printSpy(paper),
  ReceiptPrintArea: () => null,
}));

import { SaleCompletedDialog } from "./sale-completed-dialog";

const SALE = {
  saleNumber: 1234,
  total: 50,
  paymentMethod: "DINHEIRO",
  change: 0,
  customerName: null,
  invoiceGenerated: false,
};

const RECEIPT: ReceiptSaleData = {
  org: { name: "Loja Teste" },
  sale: { number: 1234, date: "2026-08-28T12:00:00.000Z" },
  items: [{ name: "Arroz 5kg", quantity: 1, unitPrice: 50, total: 50 }],
  subtotal: 50,
  discount: 0,
  total: 50,
  payments: [{ method: "DINHEIRO", amount: 50 }],
};

function renderDialog(props: { autoPrint?: boolean } = {}) {
  return render(
    <SaleCompletedDialog
      open
      onOpenChange={() => {}}
      sale={SALE}
      receiptData={RECEIPT}
      onNewSale={() => {}}
      onPrintInvoice={() => {}}
      {...props}
    />,
  );
}

// Regressão do bug relatado pelo cliente (Diebold IM453HU): o checkbox
// "Imprimir Cupom" do pagamento era um interruptor morto — a venda finalizava e
// o diálogo de impressão nunca abria.
describe("SaleCompletedDialog", () => {
  beforeEach(() => {
    printSpy.mockClear();
    templateQuery.data = undefined;
    templateQuery.isPending = false;
  });

  it("imprime sozinho quando autoPrint vem marcado", async () => {
    renderDialog({ autoPrint: true });

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(printSpy).toHaveBeenCalledWith("MM80");
  });

  it("não imprime sozinho quando autoPrint vem desmarcado", async () => {
    renderDialog({ autoPrint: false });

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(printSpy).not.toHaveBeenCalled();
  });

  it("espera o template padrão resolver antes de imprimir", async () => {
    templateQuery.isPending = true;
    renderDialog({ autoPrint: true });

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(printSpy).not.toHaveBeenCalled();
  });

  it("mantém a impressão manual pelo botão Imprimir", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /Imprimir/ }));

    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
