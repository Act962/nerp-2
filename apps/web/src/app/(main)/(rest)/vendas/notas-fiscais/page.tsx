import { NotasFiscais } from "@/features/fiscal/components/notas-fiscais";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("vendas");
  return <NotasFiscais />;
}
