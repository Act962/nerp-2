import { KitchenBoard } from "@/features/pedidos/components/pedidos-board";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("pedidos");
  return <KitchenBoard />;
}
