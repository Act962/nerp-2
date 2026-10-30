import { ProntidaoFiscal } from "@/features/fiscal/components/prontidao-fiscal";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("produtos");
  return <ProntidaoFiscal />;
}
