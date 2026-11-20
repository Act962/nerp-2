import { Suspense } from "react";
import { requirePermission } from "@/lib/auth-utils";
import { TelaDeProdutos } from "@/features/forca-vendas/components/produtos";

export default async function Page() {
  await requirePermission("forca-vendas");
  return (
    <Suspense>
      <TelaDeProdutos />
    </Suspense>
  );
}
