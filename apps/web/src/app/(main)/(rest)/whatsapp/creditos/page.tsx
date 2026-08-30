import { PageHeader } from "@/components/page-header";
import { CreditosContainer } from "@/features/stars/components/creditos-container";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("whatsapp");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Créditos"
        description="O crédito consumido por mensagem enviada, e o extrato de cada movimento."
      />
      <CreditosContainer />
    </div>
  );
}
