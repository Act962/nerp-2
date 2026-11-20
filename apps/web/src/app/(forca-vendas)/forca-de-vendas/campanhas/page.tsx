import { requirePermission } from "@/lib/auth-utils";
import { TelaEmBreve } from "@/features/forca-vendas/components/avisos-e-metas";

export default async function Page() {
  await requirePermission("forca-vendas");
  return <TelaEmBreve chave="campanhas" />;
}
