import { requirePermission } from "@/lib/auth-utils";
import { TelaDeOfertas } from "@/features/forca-vendas/components/ofertas";

export default async function Page() {
  await requirePermission("forca-vendas");
  return <TelaDeOfertas />;
}
