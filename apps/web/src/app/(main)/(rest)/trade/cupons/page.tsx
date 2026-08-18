import { PageHeader } from "@/components/page-header";
import { CouponsManager } from "@/features/coupon/components/coupons-manager";
import { requirePermission } from "@/lib/auth-utils";

// Cupons do app do cliente — incluindo os patrocinados pela indústria.
export default async function CouponsPage() {
  await requirePermission("cupons");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cupons"
        description="Descontos que aparecem no app do cliente. Podem ser patrocinados por uma indústria (ROI mensurável)."
      />
      <CouponsManager />
    </div>
  );
}
