import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

export const getMapObjectAudit = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary:
      "Rastreabilidade do elemento (última visita, promotor, supervisor)",
    tags: ["mapObject"],
  })
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      lastVisitAt: z.string().nullable(),
      promoterName: z.string().nullable(),
      supervisorName: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const object = await prisma.mapObject.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: {
        lastVisitAt: true,
        lastEditedById: true,
        lastEditedBy: { select: { name: true } },
      },
    });

    if (!object) {
      throw errors.NOT_FOUND({ message: "Elemento não encontrado" });
    }

    // O supervisor não fica no elemento: vem da relação no cadastro do promotor.
    const membership = object.lastEditedById
      ? await prisma.member.findFirst({
          where: {
            organizationId: context.org.id,
            userId: object.lastEditedById,
          },
          select: {
            supervisor: { select: { user: { select: { name: true } } } },
          },
        })
      : null;

    return {
      lastVisitAt: object.lastVisitAt?.toISOString() ?? null,
      promoterName: object.lastEditedBy?.name ?? null,
      supervisorName: membership?.supervisor?.user.name ?? null,
    };
  });
