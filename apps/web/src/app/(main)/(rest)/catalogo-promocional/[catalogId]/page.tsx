import { CatalogEditor } from "@/features/promotional-catalog/catalog-editor";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page({
  params,
}: {
  params: Promise<{ catalogId: string }>;
}) {
  // Abrir o catálogo = permissão da página. Salvar exige a ação
  // `catalogo-promocional-editar` (o editor entra em modo leitura sem ela).
  await requirePermission("catalogo-promocional");
  const { catalogId } = await params;
  return <CatalogEditor catalogId={catalogId} />;
}
