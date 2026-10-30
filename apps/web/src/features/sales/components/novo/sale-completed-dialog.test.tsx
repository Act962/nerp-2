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

// O documento fiscal da venda também vem do servidor (polling).
const nfceQuery: { data: unknown; isPending: boolean } = {
  data: undefined,
  isPending: false,
};
vi.mock("@/features/fiscal/hooks/use-nfce", () => ({
  useNfceDaVenda: () => nfceQuery,
  useTentarNfceNovamente: () => ({ mutate: vi.fn(), isPending: false }),
  useReenviarNfce: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelarNfce: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SaleCompletedDialog } from "./sale-completed-dialog";

const SALE = {
  saleNumber: 1234,
  total: 50,
  paymentMethod: "DINHEIRO",
  change: 0,
  customerName: null,
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

const NFCE_AUTORIZADA = {
  id: "doc-1",
  saleId: "venda-1",
  status: "AUTHORIZED",
  ambiente: "HOMOLOGACAO",
  serie: 1,
  numero: 7,
  chave: "22261111222333000181650010000000071123456785",
  protocolo: "222260000000001",
  autorizadoEm: "2026-11-03T13:00:01.000Z",
  qrCodeUrl: "https://simulado.nerp.invalid/nfce?p=x|3|2",
  consultaUrl: "https://simulado.nerp.invalid/nfce/consulta",
  rejeicao: null,
  destinatario: null,
  tentativas: 1,
  canceladoEm: null,
};

function renderDialog(
  props: { autoPrint?: boolean; nfceSolicitada?: boolean } = {},
) {
  const { nfceSolicitada, ...resto } = props;
  return render(
    <SaleCompletedDialog
      open
      onOpenChange={() => {}}
      sale={{ ...SALE, saleId: "venda-1", nfceSolicitada }}
      receiptData={RECEIPT}
      onNewSale={() => {}}
      {...resto}
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
    nfceQuery.data = undefined;
    nfceQuery.isPending = false;
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

  it("com NFC-e pedida, não imprime enquanto a SEFAZ não autoriza", async () => {
    nfceQuery.data = { ...NFCE_AUTORIZADA, status: "PROCESSING", chave: null };
    renderDialog({ autoPrint: true, nfceSolicitada: true });

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(printSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Aguardando a SEFAZ");
  });

  it("com NFC-e autorizada, imprime o DANFCe sozinho", async () => {
    nfceQuery.data = NFCE_AUTORIZADA;
    renderDialog({ autoPrint: true, nfceSolicitada: true });

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent(
      "NFC-e nº 7 autorizada (homologação",
    );
    expect(screen.getByRole("button", { name: /DANFCe/ })).toBeEnabled();
  });

  it("NFC-e rejeitada não imprime sozinho e mostra o motivo", async () => {
    nfceQuery.data = {
      ...NFCE_AUTORIZADA,
      status: "REJECTED",
      chave: null,
      rejeicao: { codigo: "778", motivo: "Informado NCM inexistente" },
    };
    renderDialog({ autoPrint: true, nfceSolicitada: true });

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(printSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "NFC-e rejeitada (778): Informado NCM inexistente",
    );
  });

  it("mantém a impressão manual pelo botão Imprimir", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /Imprimir/ }));

    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
