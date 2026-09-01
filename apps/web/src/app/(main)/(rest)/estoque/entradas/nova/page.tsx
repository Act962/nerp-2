import { PurchaseEditor } from "@/features/purchases/components/purchase-editor";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("estoque");

  return <PurchaseEditor />;
}
