import { PageHeader } from "@/components/page-header";
import { CatalogPdvManager } from "@/features/trade-catalog/components/catalog-pdv-manager";
import { requirePermission } from "@/lib/auth-utils";

export default async function CatalogoPdvPage() {
  await requirePermission("catalogo-pdv");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo PDV"
        description="Preço sugerido por mídia a partir do custo do m² da loja, com benchmark regional."
      />
      <CatalogPdvManager />
    </div>
  );
}
