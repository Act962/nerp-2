import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";
import z from "zod";

// Sem `requireOrgMiddleware`: quem aceita ainda não é membro de organização
// alguma — é justamente o que esta rota resolve.
export const acceptInvitation = base
  .use(requireAuthMiddleware)
  .route({
    method: "POST",
    summary: "Aceitar um convite",
    tags: ["invitations"],
  })
  .input(z.object({ invitationId: z.string() }))
  .output(z.object({ organizationId: z.string() }))
  .handler(async ({ context, input, errors }) => {
    try {
      const result = await auth.api.acceptInvitation({
        headers: context.headers,
        body: { invitationId: input.invitationId },
      });

      const organizationId = result?.invitation?.organizationId;

      if (!organizationId) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Não foi possível aceitar o convite.",
        });
      }

      // Deixa a org recém-aceita ativa para o usuário cair direto nela.
      await auth.api.setActiveOrganization({
        headers: context.headers,
        body: { organizationId },
      });

      return { organizationId };
    } catch (error) {
      if (error instanceof APIError) {
        throw errors.BAD_REQUEST({ message: error.message });
      }
      throw error;
    }
  });
