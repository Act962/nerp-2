import { MapViewerWorkspace } from "@/features/store-map/components/map-viewer-workspace";
import { requirePermission } from "@/lib/auth-utils";

export default async function PdvMapPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  await requirePermission("lojas");
  const { storeId } = await params;

  return <MapViewerWorkspace storeId={storeId} />;
}
