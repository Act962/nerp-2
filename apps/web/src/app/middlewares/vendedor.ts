import { resolverVendedor } from "@/features/forca-vendas/server/escopo-equipe";
import { type BaseContext, base } from "./base";

// Os dois middlewares rodam depois de `requireAuthMiddleware` e
// `requireOrgMiddleware`; o contexto já traz `user` e `org` em tempo de
// execução, só o tipo do `base` não sabe disso.
type ContextoComOrg = BaseContext & {
  user?: { id: string };
  org?: { id: string };
};

/**
 * Injeta `context.vendedor`: quem é o membro na Força de Vendas, o que pode e
 * quem enxerga (`escopo`). Exige a permissão do app de campo (ou a gestão).
 */
export const requireVendedorMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const { user, org } = context as ContextoComOrg;
    if (!user || !org) throw errors.UNAUTHORIZED();
    const vendedor = await resolverVendedor(org.id, user.id);
    if (!vendedor?.acessaCampo) {
      throw errors.FORBIDDEN({
        message: "Você não tem acesso à Força de Vendas",
      });
    }
    return next({ context: { vendedor } });
  },
);

/** Mesmo contexto, para o painel do gestor: exige `forca-vendas-gestao`. */
export const requireGestorFvMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const { user, org } = context as ContextoComOrg;
    if (!user || !org) throw errors.UNAUTHORIZED();
    const vendedor = await resolverVendedor(org.id, user.id);
    if (!vendedor?.ehGestor) {
      throw errors.FORBIDDEN({
        message: "Esta área é da gestão da Força de Vendas",
      });
    }
    return next({ context: { vendedor } });
  },
);
