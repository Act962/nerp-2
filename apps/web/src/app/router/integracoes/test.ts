import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { sanitizarErro } from "@/features/integracoes/server/credentials";
import { criarConector } from "@/features/integracoes/server/resolve-connector";
import { requireOrgAdmin } from "./_access";
import { montarCredenciais } from "./_credenciais";
import { credenciaisInputSchema } from "./_schema";

// Testa com os valores do formulário ANTES de gravar. Segredo em branco
// reaproveita o cifrado. Falha de credencial é RESULTADO (`ok: false`), não
// exceção — e a mensagem passa pelo sanitizador antes de chegar na tela.
export const testIntegracao = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Testar credenciais de uma integração",
    tags: ["integracoes"],
  })
  .input(credenciaisInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const { valores } = await montarCredenciais(context.org.id, input);

    try {
      return await criarConector(input.providerId, valores).testarConexao();
    } catch (error) {
      return {
        ok: false as const,
        mensagem: sanitizarErro(
          (error as Error).message,
          Object.values(valores),
        ),
      };
    }
  });
