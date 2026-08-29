import { PageHeader } from "@/components/page-header";
import { ScannerPage } from "@/features/scanner/components/scanner-page";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("vendas");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leitor de Código"
        description="Transforme um celular em leitor de código de barras do PDV"
      />
      <ScannerPage />
    </div>
  );
}
