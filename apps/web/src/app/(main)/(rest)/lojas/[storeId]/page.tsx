import { StoreDetail } from "@/features/stores/components/store-detail";
import { requirePermission } from "@/lib/auth-utils";

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  await requirePermission("lojas");
  const { storeId } = await params;

  return <StoreDetail storeId={storeId} />;
}
