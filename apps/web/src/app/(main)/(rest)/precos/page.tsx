import { requirePermission } from "@/lib/auth-utils";
import { PriceListsPanel } from "@/features/precos/components/price-lists-panel";

export default async function Page() {
  await requirePermission("precos");
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Tabelas de preço</h1>
        <p className="text-sm text-muted-foreground">
          Preços por tipo de cliente (Varejo, Atacado, Revendedor…) com faixas
          por quantidade. Vincule cada tabela a um cliente no cadastro.
        </p>
      </div>
      <PriceListsPanel />
    </div>
  );
}
