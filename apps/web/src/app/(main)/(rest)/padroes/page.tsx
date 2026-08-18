import { PageHeader } from "@/components/page-header";
import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { TemplatesIndustriesList } from "@/features/books/components/templates-industries-list";

export default async function TemplatesPage() {
  await requireTradeAccess("books");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Padrões"
        description="Cada indústria precisa de capa, páginas de fotos e página final para gerar books. Escolha uma indústria para configurar."
      />
      <TemplatesIndustriesList />
    </div>
  );
}
