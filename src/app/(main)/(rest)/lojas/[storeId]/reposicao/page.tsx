import { PageHeader } from "@/components/page-header";
import { ReposicaoManager } from "@/features/store-inventory/components/reposicao-manager";
import { requirePermission } from "@/lib/auth-utils";

// Painel do repositor: validades (perto de vencer) + rupturas por loja.
export default async function ReposicaoPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  await requirePermission("lojas");
  const { storeId } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reposição"
        description="Acompanhe validades e rupturas da loja. Produtos perto de vencer podem ir para liquidação (aparece no app do cliente)."
      />
      <ReposicaoManager storeId={storeId} />
    </div>
  );
}
