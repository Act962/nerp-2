import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

// Retorna o Member do usuário logado para a org ativa. Usado pelo cliente para
// filtrar a sidebar e por server-side guards. Owner/Admin não dependem de
// permissions[] — sempre veem tudo.
export const getCurrentMember = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Membership do usuário logado na org ativa",
    tags: ["members"],
  })
  .input(z.object({}))
  .output(
    z
      .object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        permissions: z.array(z.string()),
        hiddenModules: z.array(z.string()),
        dashboardModules: z.array(z.string()),
        orgDisabledModules: z.array(z.string()),
      })
      .nullable(),
  )
  .handler(async ({ context }) => {
    const [member, organization] = await Promise.all([
      prisma.member.findFirst({
        where: {
          organizationId: context.org.id,
          userId: context.user.id,
        },
        select: {
          id: true,
          role: true,
          permissions: true,
          hiddenModules: true,
          dashboardModules: true,
          user: { select: { name: true } },
        },
      }),
      prisma.organization.findUnique({
        where: { id: context.org.id },
        select: { disabledModules: true },
      }),
    ]);

    if (!member) return null;

    return {
      id: member.id,
      name: member.user.name,
      role: member.role,
      permissions: member.permissions ?? [],
      hiddenModules: member.hiddenModules ?? [],
      dashboardModules: member.dashboardModules ?? [],
      // Vem junto porque a sidebar precisa das três camadas numa consulta só.
      orgDisabledModules: organization?.disabledModules ?? [],
    };
  });
