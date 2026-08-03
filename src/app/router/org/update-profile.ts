import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { isValidCnpj, normalizeDocument } from "@/lib/document";
import { ORG_SEGMENTS, SEGMENT_DEFAULT_DISABLED } from "@/lib/org-segment";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";

/**
 * Perfil da organização: segmento, praça e CNPJ.
 *
 * O CNPJ mora AQUI e não no cadastro inicial de propósito. Pedi-lo no momento
 * da conversão adiciona atrito onde ele custa mais, e um dígito errado cai numa
 * coluna única e bloqueia permanentemente o dono real daquele documento.
 */
export const updateOrgProfile = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      segment: z.enum(ORG_SEGMENTS).optional(),
      city: z.string().trim().max(120).nullable().optional(),
      state: z.string().trim().max(2).nullable().optional(),
      document: z.string().trim().max(24).nullable().optional(),
      /**
       * Só na criação: semeia os módulos do segmento. Numa troca posterior de
       * segmento NÃO se mexe nos módulos — sobrescrever a escolha manual do
       * dono é destruição de dado.
       */
      seedModules: z.boolean().default(false),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findFirst({
      where: { organizationId: context.org.id, userId: context.user.id },
      select: { role: true },
    });
    // Segmento redesenha o menu de todo mundo na organização.
    if (!member || !hasFullAccess(member.role)) {
      throw errors.FORBIDDEN({
        message: "Só o dono ou administrador altera o perfil da empresa",
      });
    }

    let document: string | null | undefined;
    if (input.document !== undefined) {
      if (input.document === null || input.document === "") {
        document = null;
      } else {
        const digits = normalizeDocument(input.document);
        if (!digits || (digits.length === 14 && !isValidCnpj(digits))) {
          throw errors.BAD_REQUEST({ message: "Informe um CNPJ válido" });
        }
        document = digits;
      }
    }

    try {
      await prisma.organization.update({
        where: { id: context.org.id },
        data: {
          ...(input.segment ? { segment: input.segment } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.state !== undefined
            ? { state: input.state?.toUpperCase() ?? null }
            : {}),
          ...(document !== undefined ? { document } : {}),
          ...(input.seedModules && input.segment
            ? { disabledModules: SEGMENT_DEFAULT_DISABLED[input.segment] }
            : {}),
        },
      });
    } catch {
      // P2002 no documento: a coluna é única entre organizações. O mapa de
      // erros tipado do projeto não tem CONFLICT — BAD_REQUEST com a frase
      // certa é melhor que inventar um código que o cliente não conhece.
      throw errors.BAD_REQUEST({
        message: "Este CNPJ já está em uso por outra organização",
      });
    }

    return { id: context.org.id };
  });
