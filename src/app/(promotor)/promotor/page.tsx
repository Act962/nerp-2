import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { PromotorApp } from "@/features/promotor/components/promotor-app";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function PromotorPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; supplierId?: string }>;
}) {
  await requireTradeAccess("promotor");
  // Nome do promotor precisa chegar ao client para ser carimbado na foto.
  const session = await auth.api.getSession({ headers: await headers() });
  const { storeId, supplierId } = await searchParams;
  return (
    <PromotorApp
      promoterName={session?.user?.name ?? "Promotor"}
      initialStoreId={storeId}
      initialSupplierId={supplierId}
    />
  );
}
