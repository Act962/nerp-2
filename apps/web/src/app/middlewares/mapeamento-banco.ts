import { podeMapearBanco } from "@/features/mapeamento-banco/server/acesso";
import { base } from "./base";

/**
 * Portão das procedures do mapeamento do banco. Vem DEPOIS de
 * `requireAuthMiddleware` e `requireOrgMiddleware`, que põem `user` e `org`.
 *
 * Chave de integração (S2S) e terminal nunca passam: é uma tela de pessoa, e
 * expõe dado cru do banco do cliente.
 */
export const requireMapeamentoBancoMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const { org, user } = context as {
      org?: { id: string };
      user?: { id: string; email: string };
    };
    if (!org || !user) {
      throw new Error(
        "requireMapeamentoBancoMiddleware precisa vir após requireAuthMiddleware e requireOrgMiddleware",
      );
    }
    if (context.isS2S || context.isDevice) {
      throw errors.FORBIDDEN({
        message: "O mapeamento do banco só é acessível pela tela.",
      });
    }
    if (!(await podeMapearBanco(org.id, user))) {
      throw errors.FORBIDDEN({
        message: "O mapeamento do banco é restrito à equipe interna.",
      });
    }
    return next();
  },
);
