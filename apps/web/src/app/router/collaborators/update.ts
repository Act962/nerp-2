import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const updateCollaborator = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PATCH",
    summary: "Atualizar colaborador",
    tags: ["collaborators"],
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(2).optional(),
      role: z.string().min(1).optional(),
      photoUrl: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ context, input, errors }) => {
    const existing = await prisma.collaborator.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!existing) {
      throw errors.NOT_FOUND({ message: "Colaborador não encontrado!" });
    }

    const updated = await prisma.collaborator.update({
      where: { id: input.id },
      data: {
        name: input.name,
        role: input.role,
        photoUrl:
          input.photoUrl === undefined
            ? undefined
            : input.photoUrl?.trim() || null,
        isActive: input.isActive,
      },
    });

    return { id: updated.id };
  });
