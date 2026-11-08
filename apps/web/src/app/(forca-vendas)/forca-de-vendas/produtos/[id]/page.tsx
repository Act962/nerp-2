import { Suspense } from "react";
import { requirePermission } from "@/lib/auth-utils";
import { FichaDoProduto } from "@/features/forca-vendas/components/produtos";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("forca-vendas");
  const { id } = await params;
  return (
    <Suspense>
      <FichaDoProduto productId={id} />
    </Suspense>
  );
}
