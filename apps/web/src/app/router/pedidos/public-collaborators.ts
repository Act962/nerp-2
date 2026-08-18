import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

// Rota pública (sem requireAuth): a confiança vem do orgSlug, mesmo modelo
// do painel TV. Devolve apenas dados públicos do colaborador (nada sensível).
export const publicCollaborators = base
  .route({
    method: "GET",
    summary: "Colaboradores ativos da org (kiosk do garçom)",
    tags: ["kitchen"],
  })
  .input(z.object({ orgSlug: z.string().min(1) }))
  .output(
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        photoUrl: z.string().nullable(),
      }),
    ),
  )
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true },
    });

    if (!org) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    const collaborators = await prisma.collaborator.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, photoUrl: true },
    });

    return collaborators;
  });
