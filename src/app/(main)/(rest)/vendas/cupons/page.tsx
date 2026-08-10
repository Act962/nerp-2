import { PageHeader } from "@/components/page-header";
import { ReceiptDesigner } from "@/features/receipt-designer/components/receipt-designer";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("cupom-designer");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor de cupom"
        description="Modelos de cupom para impressão (80mm, 58mm, A4)"
      />
      <ReceiptDesigner />
    </div>
  );
}
