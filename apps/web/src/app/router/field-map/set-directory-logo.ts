import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { isSuperAdmin } from "@/lib/super-admin";
import { z } from "zod";

/**
 * Logo do varejo conhecido — linha GLOBAL, super-admin apenas.
 *
 * Sem `requireOrgMiddleware` de propósito: `DirectoryStore` não pertence a
 * organização nenhuma, e exigir org ativa aqui daria a impressão errada de que
 * a escrita é escopada por inquilino. Mesmo desenho de
 * `router/media-model-photo/create.ts`, o outro recurso global do sistema.
 */
export const setDirectoryStoreLogo = base
  .use(requireAuthMiddleware)
  .input(
    z.object({
      directoryStoreId: z.string().min(1),
      /** `COMPANY` troca a bandeira da rede inteira; `POINT` só desta loja. */
      scope: z.enum(["COMPANY", "POINT"]).default("COMPANY"),
      /**
       * Só chave do R2. `constructUrl` devolve verbatim qualquer coisa que
       * comece com `/` ou `http`, e numa linha global um valor solto renderiza
       * no mapa de TODOS os inquilinos — a leitura de `/marcas/...` semeado por
       * migração continua valendo, mas a escrita pela interface não.
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
  .output(
    z.object({
      scope: z.enum(["COMPANY", "POINT"]),
      affected: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!isSuperAdmin(context.user.email)) {
      throw errors.FORBIDDEN({
        message: "Só a administração do TradeGram edita o varejo global",
      });
    }

    const point = await prisma.directoryStore.findUnique({
      where: { id: input.directoryStoreId },
      select: { id: true, companyId: true },
    });
    if (!point) {
      throw errors.NOT_FOUND({ message: "Ponto não encontrado" });
    }

    if (input.scope === "POINT" || !point.companyId) {
      await prisma.directoryStore.update({
        where: { id: point.id },
        data: { logoKey: input.logoKey },
      });
      return { scope: "POINT" as const, affected: 1 };
    }

    // Trocar a bandeira de uma loja e deixar as outras 26 erradas é justamente
    // o incômodo — por isso o padrão é a rede. O override por ponto é limpo
    // junto, senão ele venceria a logo nova sem ninguém entender por quê.
    const [, points] = await prisma.$transaction([
      prisma.directoryCompany.update({
        where: { id: point.companyId },
        data: { logoKey: input.logoKey },
      }),
      prisma.directoryStore.updateMany({
        where: { companyId: point.companyId },
        data: { logoKey: null },
      }),
    ]);

    return { scope: "COMPANY" as const, affected: points.count };
  });
