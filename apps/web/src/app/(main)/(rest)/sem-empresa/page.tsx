import { redirect } from "next/navigation";
import { currentOrganization, requireAuth } from "@/lib/auth-utils";

/**
 * Destino de quem está logado mas não pertence a nenhuma organização.
 *
 * A tela em si é a `EmptyOrganization`, desenhada pelo layout de `(main)`
 * quando não há organização ativa — esta página existe só para dar um endereço
 * a esse estado. Antes os guards mandavam para `/create-organization`, ou seja,
 * empurravam para criar outra empresa justamente quem já tinha uma conta e
 * tinha se perdido; era o que gerava o chamado de "sumiram meus dados".
 *
 * Sem `requirePermission` de propósito: permissão pressupõe organização, e é a
 * falta dela que traz alguém aqui. Quem TEM organização não tem o que ver nesta
 * rota e volta para o dashboard.
 */
export default async function Page() {
  await requireAuth();

  const org = await currentOrganization();
  if (org) redirect("/dashboard");

  return null;
}
