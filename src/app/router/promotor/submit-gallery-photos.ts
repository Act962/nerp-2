import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Envia rascunhos da Galeria App pra fila da coordenadora: seta submittedAt.
// Só rascunhos do PRÓPRIO promotor (createdById), da org, ainda não enviados.
export const submitGalleryPhotos = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ photoIds: z.array(z.string()).min(1) }))
  .output(z.object({ submitted: z.number() }))
  .handler(async ({ input, context }) => {
    const result = await prisma.pdvPhoto.updateMany({
      where: {
        id: { in: input.photoIds },
        organizationId: context.org.id,
        createdById: context.user.id,
        submittedAt: null,
      },
      data: { submittedAt: new Date() },
    });

    return { submitted: result.count };
  });
