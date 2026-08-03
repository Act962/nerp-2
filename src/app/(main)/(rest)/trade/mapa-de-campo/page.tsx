import { PageHeader } from "@/components/page-header";
import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { MapaDeCampoContainer } from "@/features/mapa-de-campo/components/mapa-de-campo-container";

// Mapa geográfico do campo: onde estão os clientes e por onde o promotor passou.
// A posição das lojas nasce das fotos capturadas no local — ver
// `src/app/router/promotor/_store-position.ts`.
export default async function TradeMapaDeCampoPage() {
  await requireTradeAccess("mapa-de-campo");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapa de Campo"
        description="Clientes no mapa e o trajeto do promotor no dia, montado a partir das fotos capturadas em loja."
      />
      <MapaDeCampoContainer />
    </div>
  );
}
