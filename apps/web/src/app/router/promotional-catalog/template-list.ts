import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isSuperUser } from "./_super-user";

const templateItem = z.object({
  id: z.string(),
  name: z.string(),
  config: z.unknown(),
  thumbnail: z.string().nullable(),
  createdAt: z.date(),
});

// Lista os padrões: "mine" (da organização) e "system" (universais). O
// `canManageSystem` diz se o usuário logado é o super usuário (pode criar/
// excluir padrões do sistema).
export const listCatalogTemplates = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar padrões de catálogo",
    tags: ["promotional-catalog"],
  })
  .input(z.object({}))
  .output(
    z.object({
      mine: z.array(templateItem),
      system: z.array(templateItem),
      canManageSystem: z.boolean(),
    }),
  )
  .handler(async ({ context }) => {
    const select = {
      id: true,
      name: true,
      config: true,
      thumbnail: true,
      createdAt: true,
    } as const;
    const [mine, system] = await Promise.all([
      prisma.promotionalCatalogTemplate.findMany({
        where: { scope: "USER", organizationId: context.org.id },
        select,
        orderBy: { createdAt: "desc" },
      }),
      prisma.promotionalCatalogTemplate.findMany({
        where: { scope: "SYSTEM" },
        select,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { mine, system, canManageSystem: isSuperUser(context.user.email) };
  });
