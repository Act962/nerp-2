import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { IndustryTemplatesDetail } from "@/features/books/components/industry-templates-detail";

export default async function IndustryTemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireTradeAccess("books");
  const { id } = await params;
  return (
    <div className="space-y-6">
      <IndustryTemplatesDetail supplierId={id} />
    </div>
  );
}
