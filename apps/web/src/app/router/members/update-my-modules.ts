import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { isModuleHideable, PAGE_PERMISSION_KEYS } from "@/lib/permissions";
import { z } from "zod";

const validKeys = new Set<string>(PAGE_PERMISSION_KEYS);

function sanitize(keys: string[], hideableOnly: boolean) {
  return Array.from(
    new Set(
      keys.filter(
        (key) => validKeys.has(key) && (!hideableOnly || isModuleHideable(key)),
      ),
    ),
  );
}

// Preferência do próprio usuário — sem memberId no input de propósito: cada um
// só mexe no próprio menu, então o alvo vem da sessão e não do cliente.
export const updateMyModules = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      hiddenModules: z.array(z.string()).optional(),
      dashboardModules: z.array(z.string()).optional(),
    }),
  )
  .output(
    z.object({
      hiddenModules: z.array(z.string()),
      dashboardModules: z.array(z.string()),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { id: true },
    });

    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado" });
    }

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: {
        hiddenModules: input.hiddenModules
          ? sanitize(input.hiddenModules, true)
          : undefined,
        // Atalho no dashboard vale pra qualquer módulo, inclusive os sempre
        // visíveis no menu — são coisas independentes.
        dashboardModules: input.dashboardModules
          ? sanitize(input.dashboardModules, false)
          : undefined,
      },
      select: { hiddenModules: true, dashboardModules: true },
    });

    return updated;
  });
