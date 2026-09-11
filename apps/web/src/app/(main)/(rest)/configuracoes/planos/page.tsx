import { PageHeader } from "@/components/page-header";
import { Planos } from "@/features/billing/components/planos";
import { requireAuth } from "@/lib/auth-utils";

export default async function Page() {
  await requireAuth();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Planos"
        description="O que cada plano inclui: Stars, cadastros e limites. Os módulos de Trade Marketing têm plano próprio em Trade › Plano."
      />
      <Planos />
    </div>
  );
}
