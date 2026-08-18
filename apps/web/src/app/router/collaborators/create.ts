import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const createCollaborator = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Criar colaborador",
    tags: ["collaborators"],
  })
  .input(
    z.object({
      name: z.string().min(2, "Informe o nome"),
      role: z.string().min(1, "Informe a função"),
      photoUrl: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ context, input }) => {
    const collaborator = await prisma.collaborator.create({
      data: {
        organizationId: context.org.id,
        name: input.name,
        role: input.role,
        photoUrl: input.photoUrl?.trim() || null,
      },
    });

    return { id: collaborator.id };
  });
