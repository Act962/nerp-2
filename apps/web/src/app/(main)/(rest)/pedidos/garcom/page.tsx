import { currentOrganization, requirePermission } from "@/lib/auth-utils";
import { notFound, redirect } from "next/navigation";

/**
 * Atalho fixo para o app do garçom.
 *
 * A tela real é `/registrar-pedido/<slug>`, mobile e sem o chrome do ERP. Até
 * aqui só se chegava nela pelo QR de convite — que hoje falha quando falta
 * `SYNC_SHARED_SECRET` —, então o dono não tinha caminho pelo menu.
 */
export default async function Page() {
  await requirePermission("pedidos");
  const org = await currentOrganization();
  if (!org?.slug) notFound();
  redirect(`/registrar-pedido/${org.slug}`);
}
