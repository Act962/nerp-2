import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { criarSandbox } from "@/features/onboarding/server/criar-sandbox";
import { respostasDoWizardSchema } from "@/features/onboarding/lib/respostas";

/**
 * Recuperação: quem entrou anônimo e ficou sem organização (o hook do
 * `sign-in/anonymous` falhou no meio) ganha a sandbox por aqui. Idempotente:
 * quem já é dono de uma recebe a que tem.
 */
export const criarSandboxProcedure = base
  .use(requireAuthMiddleware)
  .route({
    method: "POST",
    summary: "Cria a organização de teste",
    tags: ["Onboarding"],
  })
  .input(respostasDoWizardSchema.partial().default({}))
  .output(z.object({ organizationId: z.string(), criou: z.boolean() }))
  .handler(async ({ input, context }) => {
    return criarSandbox({
      userId: context.user.id,
      respostas: { interesses: [], ...input },
    });
  });
