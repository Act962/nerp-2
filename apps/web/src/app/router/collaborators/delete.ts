import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const deleteCollaborator = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "DELETE",
    summary: "Excluir colaborador",
    tags: ["collaborators"],
  })
  .input(z.object({ id: z.string() }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ context, input, errors }) => {
    const existing = await prisma.collaborator.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });

    if (!existing) {
      throw errors.NOT_FOUND({ message: "Colaborador não encontrado!" });
    }

    await prisma.collaborator.delete({ where: { id: input.id } });

    return { id: input.id };
  });
