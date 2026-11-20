import { PageHeader } from "@/components/page-header";
import { PoliticaComercial } from "@/features/forca-vendas/components/gestao/configuracoes";
import { GestaoNav } from "@/features/forca-vendas/components/gestao/gestao-nav";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("forca-vendas-gestao");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Política comercial"
        description="Desconto, flex, aprovação, check-in e condições de pagamento."
      />
      <GestaoNav />
      <PoliticaComercial />
    </div>
  );
}
