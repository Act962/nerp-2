import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { cobrancaEstaAtiva, lerRegras } from "@/features/stars/server/regras";

/**
 * O preço de cada ação cobrável, para a organização LER.
 *
 * Quem edita é o administrador da plataforma, em `/site/stars` — por isso não
 * há mais `podeEditar` aqui. A organização vê o que paga; mudar o preço de um
 * cliente é decisão comercial da casa, e deixá-la na mão do próprio cliente foi
 * como uma conta acabou com o Astro de graça sem ninguém perceber.
 */
export const listRules = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Preços por ação", tags: ["Stars"] })
  .input(z.object({}).optional())
  .output(
    z.object({
      /** Nenhuma ação com preço = nada é cobrado nem bloqueado. */
      cobrancaAtiva: z.boolean(),
      regras: z.array(
        z.object({
          actionKey: z.string(),
          label: z.string(),
          descricao: z.string(),
          stars: z.number(),
          isActive: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const regras = await lerRegras(context.org.id);
    return { cobrancaAtiva: cobrancaEstaAtiva(regras), regras };
  });
