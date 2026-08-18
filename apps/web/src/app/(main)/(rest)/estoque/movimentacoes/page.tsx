import { PageHeader } from "@/components/page-header";
import { ListMovements } from "../../../../../features/stock/movimentscoes/list-movements";
import { CreateStockMovimentModal } from "@/components/modals/stock/create-stock-moviment-modal";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page() {
  const organization = await auth.api.listMembers({
    headers: await headers(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimentações de Estoque"
        description="Visualize e gerencie as movimentações de estoque"
      >
        <CreateStockMovimentModal />
      </PageHeader>
      <ListMovements
        members={organization.members.map((member) => member.user)}
      />
    </div>
  );
}
