import { PageHeader } from "@/components/page-header";
import { MapaDaEquipe } from "@/features/forca-vendas/components/gestao/mapa";
import { GestaoNav } from "@/features/forca-vendas/components/gestao/gestao-nav";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("forca-vendas-gestao");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mapa e visitas"
        description="Onde a equipe está e o que foi visitado no dia."
      />
      <GestaoNav />
      <MapaDaEquipe />
    </div>
  );
}
