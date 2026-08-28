import { AplicativosPage } from "@/features/aplicativos/components/aplicativos-page";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("aplicativos");
  return <AplicativosPage />;
}
