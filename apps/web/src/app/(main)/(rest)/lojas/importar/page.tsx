import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ImportWizard } from "@/features/stores/components/import/import-wizard";
import { requirePermission } from "@/lib/auth-utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function Page() {
  await requirePermission("lojas");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar Lojas"
        description="Carregue um arquivo CSV ou XLSX para cadastrar lojas em massa"
      >
        <Button variant="outline" asChild>
          <Link href="/lojas">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <ImportWizard />
    </div>
  );
}
