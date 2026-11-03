import { PageHeader } from "@/components/page-header";
import { GestaoDeVendedores } from "@/features/forca-vendas/components/gestao/vendedores";
import { GestaoNav } from "@/features/forca-vendas/components/gestao/gestao-nav";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("forca-vendas-gestao");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendedores"
        description="Acesso ao app, limites de desconto e saldo flex."
      />
      <GestaoNav />
      <GestaoDeVendedores />
    </div>
  );
}
