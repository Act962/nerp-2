import { requirePermission } from "@/lib/auth-utils";
import { ListaDeConversas } from "@/features/forca-vendas/components/mensagens";

export default async function Page() {
  await requirePermission("forca-vendas");
  return <ListaDeConversas />;
}
