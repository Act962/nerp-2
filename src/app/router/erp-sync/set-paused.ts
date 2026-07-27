import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireOrgAdmin } from "./_access";

// Pausar tira a org do cron (listOrganizationsForSync ignora PAUSED) sem apagar
// as credenciais. Retomar volta para ACTIVE.
export const setErpConnectionPaused = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Pausar/retomar a sincronização de ERP",
    tags: ["erp-sync"],
  })
  .input(z.object({ paused: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const result = await prisma.erpConnection.updateMany({
      where: { organizationId: context.org.id, kind: { not: "NATIVE" } },
      data: { status: input.paused ? "PAUSED" : "ACTIVE" },
    });
    if (result.count === 0) {
      throw errors.NOT_FOUND({
        message: "Nenhuma conexão de ERP configurada.",
      });
    }

    return { paused: input.paused };
  });
