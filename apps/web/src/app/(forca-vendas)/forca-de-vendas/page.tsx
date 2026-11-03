import { requirePermission } from "@/lib/auth-utils";
import { InicioForcaVendas } from "@/features/forca-vendas/components/inicio";

export default async function Page() {
  await requirePermission("forca-vendas");
  return <InicioForcaVendas />;
}
