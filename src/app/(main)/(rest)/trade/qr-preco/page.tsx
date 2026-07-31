import { PageHeader } from "@/components/page-header";
import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { QrPriceStores } from "@/features/shopper/components/qr-price-stores";

export default async function QrPrecoPage() {
  await requireTradeAccess("qr-preco");

  return (
    <div className="space-y-6">
      <PageHeader
        title="App QR Preço"
        description="Escolha a loja para abrir o app de leitura de código de barras — o mesmo que o cliente usa ao escanear o QR na gôndola."
      />
      <QrPriceStores />
    </div>
  );
}
