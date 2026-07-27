import { PageHeader } from "@/components/page-header";
import { PromoterLinksManager } from "@/features/promotor/components/promoter-links-manager";
import { requirePermission } from "@/lib/auth-utils";

// Gestão dos vínculos do promotor: define quais indústrias e lojas cada
// promotor pode fotografar. Sem vínculo, o promotor não registra foto.
export default async function PromoterLinksPage() {
  await requirePermission("promotor-vinculos");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vínculos de Promotores"
        description="Defina quais indústrias e lojas cada promotor pode fotografar."
      />
      <PromoterLinksManager />
    </div>
  );
}
