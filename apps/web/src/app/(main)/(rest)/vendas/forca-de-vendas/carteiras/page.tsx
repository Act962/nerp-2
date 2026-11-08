import { PageHeader } from "@/components/page-header";
import { GestaoDeCarteiras } from "@/features/forca-vendas/components/gestao/carteiras";
import { GestaoNav } from "@/features/forca-vendas/components/gestao/gestao-nav";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("forca-vendas-gestao");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Carteiras"
        description="Quais clientes cada vendedor atende."
      />
      <GestaoNav />
      <GestaoDeCarteiras />
    </div>
  );
}
