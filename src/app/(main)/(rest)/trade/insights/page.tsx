import { PageHeader } from "@/components/page-header";
import { ShopperInsights } from "@/features/shopper-insights/components/shopper-insights";
import { requirePermission } from "@/lib/auth-utils";

// Analytics do comportamento do shopper para a indústria (fecha o ciclo).
export default async function ShopperInsightsPage() {
  await requirePermission("insights");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights do Cliente"
        description="Comportamento do consumidor no app — escaneamentos, favoritos e atenção por produto/indústria. Valor para a indústria."
      />
      <ShopperInsights />
    </div>
  );
}
