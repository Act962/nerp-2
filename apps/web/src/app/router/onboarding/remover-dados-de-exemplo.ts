import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { removerDadosDeExemplo as remover } from "@/features/onboarding/server/remover-demo";
import { isOrgAdmin } from "@/lib/org-access";

/**
 * Apaga os dados de exemplo da organização. Só administrador: é uma exclusão
 * em massa, mesmo que de coisa que não é de ninguém.
 */
export const removerDadosDeExemplo = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Remove os dados de exemplo",
    tags: ["Onboarding"],
  })
  .input(z.object({}))
  .output(
    z.object({
      produtos: z.number(),
      categorias: z.number(),
      clientes: z.number(),
      fornecedores: z.number(),
      lojas: z.number(),
      catalogos: z.number(),
      mantidos: z.number(),
    }),
  )
  .handler(async ({ context, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores podem remover os dados de exemplo.",
      });
    }
    return remover(context.org.id);
  });
