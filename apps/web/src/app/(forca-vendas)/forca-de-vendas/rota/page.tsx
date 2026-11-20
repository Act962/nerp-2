import { requirePermission } from "@/lib/auth-utils";
import { TelaDeRota } from "@/features/forca-vendas/components/rota";

export default async function Page() {
  await requirePermission("forca-vendas");
  return <TelaDeRota />;
}
