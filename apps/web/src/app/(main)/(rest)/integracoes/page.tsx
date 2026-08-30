import { IntegracoesPage } from "@/features/integracoes/components/integracoes-page";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("integracoes");
  return <IntegracoesPage />;
}
