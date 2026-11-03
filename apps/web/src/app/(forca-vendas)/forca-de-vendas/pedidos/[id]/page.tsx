import { requirePermission } from "@/lib/auth-utils";
import { DetalheDoPedido } from "@/features/forca-vendas/components/pedidos";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("forca-vendas");
  const { id } = await params;
  return <DetalheDoPedido saleId={id} />;
}
