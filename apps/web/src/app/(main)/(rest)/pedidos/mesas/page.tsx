import { MesasContainer } from "@/features/mesas/components/mesas-container";
import { requirePermission } from "@/lib/auth-utils";

export const metadata = { title: "Mesas" };

export default async function Page() {
  await requirePermission("pedidos");
  return (
    <div className="p-4 md:p-6">
      <MesasContainer />
    </div>
  );
}
