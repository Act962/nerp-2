import { PageHeader } from "@/components/page-header";
import { GestaoDeAvisos } from "@/features/forca-vendas/components/gestao/avisos";
import { GestaoNav } from "@/features/forca-vendas/components/gestao/gestao-nav";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("forca-vendas-gestao");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Avisos para a equipe"
        description="Recados que abrem na tela inicial do vendedor."
      />
      <GestaoNav />
      <GestaoDeAvisos />
    </div>
  );
}
