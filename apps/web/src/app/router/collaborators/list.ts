import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const listCollaborators = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar colaboradores",
    tags: ["collaborators"],
  })
  .input(
    z.object({
      onlyActive: z.boolean().optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        photoUrl: z.string().nullable(),
        isActive: z.boolean(),
        createdAt: z.string(),
      }),
    ),
  )
  .handler(async ({ context, input }) => {
    const collaborators = await prisma.collaborator.findMany({
      where: {
        organizationId: context.org.id,
        ...(input.onlyActive ? { isActive: true } : {}),
      },
      orderBy: { name: "asc" },
    });

    return collaborators.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      photoUrl: c.photoUrl,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
    }));
  });
