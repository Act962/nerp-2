import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import {
  hasFullAccess,
  isModuleHideable,
  PAGE_PERMISSION_KEYS,
} from "@/lib/permissions";
import { z } from "zod";

const validKeys = new Set<string>(PAGE_PERMISSION_KEYS);

// Módulos que a empresa inteira não usa. Só owner/admin decidem — é o "quais
// módulos do NERP essa empresa contratou/usa", não preferência pessoal.
export const updateOrgDisabledModules = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ disabledModules: z.array(z.string()) }))
  .output(z.object({ disabledModules: z.array(z.string()) }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });

    if (!hasFullAccess(member?.role)) {
      throw errors.FORBIDDEN({
        message: "Apenas o dono ou administradores mudam os módulos da empresa",
      });
    }

    // Aceita só chaves conhecidas e ocultáveis: Dashboard e Configurações não
    // podem ser desligados, senão a empresa perde o acesso a esta própria tela.
    const sanitized = Array.from(
      new Set(
        input.disabledModules.filter(
          (key) => validKeys.has(key) && isModuleHideable(key),
        ),
      ),
    );

    const organization = await prisma.organization.update({
      where: { id: context.org.id },
      data: { disabledModules: sanitized },
      select: { disabledModules: true },
    });

    return { disabledModules: organization.disabledModules };
  });
