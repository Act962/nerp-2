import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// O App Promotor reporta, ao abrir e a cada mudança, o estado da permissão de
// geolocalização do navegador. Guarda no `member` da org ativa para o gestor
// enxergar ao vivo quem está com o GPS ligado — sem rastreamento contínuo.
export const reportGeoState = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      state: z.enum(["granted", "denied", "prompt", "unavailable"]),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context }) => {
    // `updateMany` por (org, user) evita carregar o id do member antes; o par é
    // único (`@@unique([organizationId, userId])`), então atinge só uma linha.
    await prisma.member.updateMany({
      where: { organizationId: context.org.id, userId: context.user.id },
      data: { lastGeoState: input.state, lastGeoStateAt: new Date() },
    });
    return { ok: true };
  });
