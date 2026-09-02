import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import { invalidateOutboundProvider } from "@/features/whatsapp-chat/lib/providers/resolve-outbound-provider";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";

/**
 * Desconecta o número do funil.
 *
 * Apaga só a conexão e as credenciais — conversas e mensagens ficam, porque
 * são histórico de atendimento do cliente e não pertencem ao número. Reconectar
 * depois volta a atender as mesmas conversas.
 */
export const removeConnection = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Desconecta o número de WhatsApp do funil",
    tags: ["WhatsApp"],
  })
  .input(z.object({ funnelId: z.string().min(1) }))
  .output(z.object({ removida: z.boolean() }))
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;

    if (!(await isOrgAdmin(organizationId, context.user.id))) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas administradores podem desconectar um número.",
      });
    }

    await requireFunnelDaOrg(input.funnelId, organizationId);

    // `deleteMany` com o filtro da organização: se o funil não for desta org,
    // nada é apagado — em vez de apagar pelo id vindo do cliente.
    const { count } = await prisma.whatsAppConnection.deleteMany({
      where: { funnelId: input.funnelId, organizationId },
    });

    invalidateOutboundProvider(organizationId, input.funnelId);

    return { removida: count > 0 };
  });
