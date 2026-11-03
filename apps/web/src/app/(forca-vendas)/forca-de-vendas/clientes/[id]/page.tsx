import { requirePermission } from "@/lib/auth-utils";
import { FichaDoCliente } from "@/features/forca-vendas/components/clientes";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("forca-vendas");
  const { id } = await params;
  return <FichaDoCliente customerId={id} />;
}
