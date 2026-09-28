import { PedidosTabs } from "@/features/pedidos/components/pedidos-tabs";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("pedidos");
  return <PedidosTabs />;
}
