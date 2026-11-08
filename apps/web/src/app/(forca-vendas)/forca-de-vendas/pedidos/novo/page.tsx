import { Suspense } from "react";
import { requirePermission } from "@/lib/auth-utils";
import { NovoPedido } from "@/features/forca-vendas/components/novo-pedido";

export default async function Page() {
  await requirePermission("forca-vendas");
  return (
    <Suspense>
      <NovoPedido />
    </Suspense>
  );
}
