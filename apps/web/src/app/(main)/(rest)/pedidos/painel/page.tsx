import { currentOrganization, requirePermission } from "@/lib/auth-utils";
import { notFound, redirect } from "next/navigation";

/**
 * Atalho fixo para o painel da TV.
 *
 * A tela real é `/painel/<slug>`, pública e sem sidebar — a TV do salão não faz
 * login. Esta rota existe só para o menu ter um endereço estável: a sidebar é
 * um módulo estático e não conhece o slug da organização ativa.
 */
export default async function Page() {
  await requirePermission("pedidos");
  const org = await currentOrganization();
  if (!org?.slug) notFound();
  redirect(`/painel/${org.slug}`);
}
