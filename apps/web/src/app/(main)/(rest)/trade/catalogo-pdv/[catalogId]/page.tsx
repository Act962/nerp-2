import { CatalogEditor } from "@/features/pdv-catalog/components/catalog-editor";
import { requirePermission } from "@/lib/auth-utils";

export default async function TradeCatalogDetailPage({
  params,
}: {
  params: Promise<{ catalogId: string }>;
}) {
  await requirePermission("catalogo-pdv");
  const { catalogId } = await params;

  return <CatalogEditor catalogId={catalogId} />;
}
