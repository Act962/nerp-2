import "server-only";
import { isOrgAdmin } from "@/lib/org-access";
import { ehDaEquipeDoMapeamento } from "../equipe";

/**
 * Quem pode mapear o banco do ERP de uma organização.
 *
 * Por enquanto, só a equipe interna (`equipe.ts`) E dentro de uma org em que
 * ela é admin — a página mostra dado cru do banco de produção do cliente.
 * Abrir para o próprio cliente é tirar a checagem da equipe daqui: a página e
 * as procedures passam por esta função e por mais nenhuma.
 */
export async function podeMapearBanco(
  organizationId: string,
  usuario: { id: string; email: string },
): Promise<boolean> {
  if (!ehDaEquipeDoMapeamento(usuario.email)) return false;
  return isOrgAdmin(organizationId, usuario.id);
}
