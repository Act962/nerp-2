import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ImportWizard } from "@/features/products/components/import/import-wizard";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar Produtos"
        description="Carregue um arquivo CSV ou XLSX para cadastrar produtos em massa"
      >
        <Button variant="outline" asChild>
          <Link href="/produtos">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <ImportWizard />
    </div>
  );
}
