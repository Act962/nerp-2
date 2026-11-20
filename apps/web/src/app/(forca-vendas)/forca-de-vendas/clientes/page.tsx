import { requirePermission } from "@/lib/auth-utils";
import { ListaDeClientes } from "@/features/forca-vendas/components/clientes";

export default async function Page() {
  await requirePermission("forca-vendas");
  return <ListaDeClientes />;
}
