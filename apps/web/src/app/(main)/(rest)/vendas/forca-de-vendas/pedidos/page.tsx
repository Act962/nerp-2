import { PageHeader } from "@/components/page-header";
import { ReceptorDePedidos } from "@/features/forca-vendas/components/gestao/receptor";
import { GestaoNav } from "@/features/forca-vendas/components/gestao/gestao-nav";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("forca-vendas-gestao");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos da Força de Vendas"
        description="Aprove, corte e fature os pedidos que chegam do campo."
      />
      <GestaoNav />
      <ReceptorDePedidos />
    </div>
  );
}
