import { requirePermission } from "@/lib/auth-utils";
import { TelaDeConsultas } from "@/features/forca-vendas/components/consultas";

export default async function Page() {
  await requirePermission("forca-vendas");
  return <TelaDeConsultas />;
}
