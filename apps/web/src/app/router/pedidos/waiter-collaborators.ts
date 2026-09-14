import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";
import { requireMemberOfOrgSlug } from "./_require-member-of-org-slug";

// Exige sessão + vínculo com a organização do slug. Era pública, e o
// `attendantId` que ela devolve era aceito como credencial de escrita por
// `waiterCreate`/`waiterDeliver`: quem soubesse o slug criava e "entregava"
// pedido. A página do garçom já exigia login, então fechar não custou nada.
export const waiterCollaborators = base
  .use(requireAuthMiddleware)
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
  .handler(async ({ input, context, errors }) => {
    const org = await requireMemberOfOrgSlug({
      orgSlug: input.orgSlug,
      userId: context.user.id,
      errors,
    });

    const collaborators = await prisma.collaborator.findMany({
      where: { organizationId: org.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, photoUrl: true },
    });

    return collaborators;
  });
