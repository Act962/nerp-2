import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { PromotorApp } from "@/features/promotor/components/promotor-app";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// App Vendedor: mesmo motor do App Promotor (Capturar, Rota, Minhas fotos),
// mais uma aba "Estou aqui" no início — mapa da localização com botão pra
// revelar o ponto exato. Reusa `PromotorApp` com `mode='vendedor'` para não
// duplicar a árvore de captura/rota/fotos.
export default async function VendedorPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; supplierId?: string }>;
}) {
  await requireTradeAccess("vendedor");
  const session = await auth.api.getSession({ headers: await headers() });
  const { storeId, supplierId } = await searchParams;
  return (
    <PromotorApp
      mode="vendedor"
      promoterName={session?.user?.name ?? "Vendedor"}
      initialStoreId={storeId}
      initialSupplierId={supplierId}
    />
  );
}
