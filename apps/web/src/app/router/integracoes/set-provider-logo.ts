import z from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { getManifest } from "@/features/integracoes/catalog";
import prisma from "@/lib/db";
import { isSuperAdmin } from "@/lib/super-admin";

/**
 * Logo de um provedor do catálogo — linha GLOBAL, super-admin apenas.
 *
 * Sem `requireOrgMiddleware` de propósito: a marca do Banco Inter é a mesma para
 * todo inquilino, e exigir org ativa daria a impressão errada de que a escrita é
 * escopada. Mesmo desenho de `router/field-map/set-directory-logo.ts`.
 */
export const setProviderLogo = base
  .use(requireAuthMiddleware)
  .route({
    method: "POST",
    summary: "Definir a logo de um provedor do catálogo (global)",
    tags: ["integracoes"],
  })
  .input(
    z.object({
      providerId: z.string().min(1),
      /**
       * Só chave do R2. `constructUrl` devolve verbatim o que começa com `/` ou
       * `http`, e numa linha global um valor solto renderiza no catálogo de
       * TODOS os inquilinos. `null` limpa e volta para o asset da aplicação.
       */
      logoKey: z
        .string()
        .trim()
        .min(1)
        .max(300)
        .refine(
          (key) => !key.includes("://") && !key.startsWith("/"),
          "Informe uma chave do R2",
        )
        .nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({
        message: "Só a administração do sistema edita a logo dos provedores.",
      });
    }
    if (!getManifest(input.providerId)) {
      throw errors.NOT_FOUND({ message: "Provedor não existe no catálogo." });
    }

    if (input.logoKey === null) {
      await prisma.integrationProviderLogo.deleteMany({
        where: { providerId: input.providerId },
      });
      return { logoKey: null };
    }

    await prisma.integrationProviderLogo.upsert({
      where: { providerId: input.providerId },
      create: {
        providerId: input.providerId,
        logoKey: input.logoKey,
        updatedById: context.user.id,
      },
      update: { logoKey: input.logoKey, updatedById: context.user.id },
    });

    return { logoKey: input.logoKey };
  });
