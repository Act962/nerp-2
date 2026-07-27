import { PageHeader } from "@/components/page-header";
import { DirectoryManager } from "@/features/directory/components/directory-manager";
import { requirePermission } from "@/lib/auth-utils";

// Diretório global de empresas: a base compartilhada (supermercados, indústrias
// e distribuidores) que dá lastro à busca pública. Aqui o dono reivindica a
// empresa e passa a administrá-la.
export default async function DirectoryPage() {
  await requirePermission("diretorio");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Diretório de Empresas"
        description="Base compartilhada de supermercados, indústrias e distribuidores. Reivindique a sua para administrá-la."
      />
      <DirectoryManager />
    </div>
  );
}
