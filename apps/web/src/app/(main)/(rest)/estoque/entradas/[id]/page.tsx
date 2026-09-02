import { PurchaseEditor } from "@/features/purchases/components/purchase-editor";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("estoque");
  const { id } = await params;

  return <PurchaseEditor purchaseId={id} />;
}
