import { getSiteAdminAccess } from "@/lib/site-admin";
import { base } from "./base";

/**
 * Equivalente de `requireOrgMiddleware` para o admin do site: injeta
 * `context.siteAdmin`. Não usa organização de propósito — as tabelas do site
 * são globais (ver o bloco SITE INSTITUCIONAL em `schema.prisma`).
 *
 * Principais de máquina (S2S) e de dispositivo não passam por aqui: o admin do
 * site é sempre uma pessoa logada.
 */
export const requireSiteAdminMiddleware = base.middleware(
  async ({ context, next, errors }) => {
    const siteAdmin = await getSiteAdminAccess(context.headers);
    if (!siteAdmin) {
      throw errors.FORBIDDEN({
        message: "Esta área é restrita aos administradores do site",
      });
    }
    return next({ context: { siteAdmin } });
  },
);
