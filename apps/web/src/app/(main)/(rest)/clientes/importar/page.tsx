import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ImportWizard } from "@/features/custom/components/import/import-wizard";
import { requirePermission } from "@/lib/auth-utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function Page() {
  await requirePermission("clientes");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar Clientes"
        description="Carregue um arquivo CSV ou XLSX para cadastrar clientes em massa"
      >
        <Button variant="outline" asChild>
          <Link href="/clientes">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <ImportWizard />
    </div>
  );
}
