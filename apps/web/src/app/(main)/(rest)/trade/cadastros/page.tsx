import { PageHeader } from "@/components/page-header";
import { TradeCatalogManager } from "@/features/trade-catalog/components/trade-catalog-manager";
import { requirePermission } from "@/lib/auth-utils";

export default async function TradeCadastrosPage() {
  await requirePermission("trade-cadastros");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cadastros de Trade"
        description="Tipos de mídia, negociação e setores — o padrão da Biblioteca Nacional, editável por loja."
      />
      <TradeCatalogManager />
    </div>
  );
}
