import { requirePermission } from "@/lib/auth-utils";
import { ListaDePedidos } from "@/features/forca-vendas/components/pedidos";

export default async function Page() {
  await requirePermission("forca-vendas");
  return <ListaDePedidos />;
}
