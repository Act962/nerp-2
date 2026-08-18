import { CaixaContainer } from "@/features/caixa/components/caixa-container";
import { requirePermission } from "@/lib/auth-utils";

export default async function CaixaPage() {
  await requirePermission("caixa");
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <CaixaContainer />
    </div>
  );
}
