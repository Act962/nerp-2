import { notFound } from "next/navigation";
import { MapeamentoBanco } from "@/features/mapeamento-banco/components/mapeamento-banco";
import { podeMapearBanco } from "@/features/mapeamento-banco/server/acesso";
import {
  currentOrganization,
  requireAuth,
  requirePermission,
} from "@/lib/auth-utils";

// Uso interno por enquanto: quem não pode mapear recebe 404, não "sem acesso" —
// a página nem deve parecer existir para o cliente. A regra mora em
// `podeMapearBanco`, a mesma das procedures.
export default async function Page() {
  await requirePermission("integracoes");
  const session = await requireAuth();
  const org = await currentOrganization();
  if (!org || !(await podeMapearBanco(org.id, session.user))) notFound();
  return <MapeamentoBanco />;
}
