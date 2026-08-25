import { StoreMapWorkspace } from "@/features/store-map/components/store-map-workspace";
import { requirePermission } from "@/lib/auth-utils";

export default async function StoreMapPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  await requirePermission("lojas");
  const { storeId } = await params;

  return <StoreMapWorkspace storeId={storeId} />;
}
