import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { isSuperUser } from "./_super-user";

const styleItem = z.object({
  id: z.string(),
  name: z.string(),
  style: z.unknown(),
  createdAt: z.date(),
});

// Lista os estilos de preço: "Meus estilos" (da organização) e "Estilos do
// sistema" (globais). `canManageSystem` diz se o usuário logado é o super
// usuário (pode criar/excluir estilos do sistema).
export const listPriceStyles = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Listar estilos de preço",
    tags: ["promotional-catalog"],
  })
  .input(z.object({}))
  .output(
    z.object({
      mine: z.array(styleItem),
      system: z.array(styleItem),
      canManageSystem: z.boolean(),
    }),
  )
  .handler(async ({ context }) => {
    const [mine, system] = await Promise.all([
      prisma.promotionalPriceStyle.findMany({
        where: { scope: "USER", organizationId: context.org.id },
        select: { id: true, name: true, style: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.promotionalPriceStyle.findMany({
        where: { scope: "SYSTEM" },
        select: { id: true, name: true, style: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      mine,
      system,
      canManageSystem: isSuperUser(context.user.email),
    };
  });
