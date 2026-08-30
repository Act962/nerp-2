import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";

/**
 * Revoga o acesso do Órbita.
 *
 * Marca `revokedAt` em vez de apagar a linha: a chave já foi usada, e apagar
 * levaria junto o registro de quem autorizou e quando — que é justamente o que
 * se quer consultar depois de revogar.
 *
 * O `updateMany` filtra pela organização: sem isso, o id da chave viria do
 * banco mas a autorização não seria confrontada com quem está pedindo.
 */
export const orbitaRevoke = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Revoga o acesso do Órbita CRM",
    tags: ["Integrações"],
  })
  .input(z.object({}))
  .output(z.object({ revogadas: z.number() }))
  .handler(async ({ context }) => {
    const organizationId = context.org.id;

    if (!(await isOrgAdmin(organizationId, context.user.id))) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas administradores podem revogar integrações.",
      });
    }

    const { count } = await prisma.nasaIntegrationKey.updateMany({
      where: { organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { revogadas: count };
  });
