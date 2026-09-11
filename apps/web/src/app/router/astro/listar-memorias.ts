import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/** O que o Astro lembra desta organização — e só desta. */
export const listarMemorias = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Memória do Astro", tags: ["Astro"] })
  .input(z.object({}))
  .output(
    z.object({
      memorias: z.array(
        z.object({
          id: z.string(),
          chave: z.string(),
          texto: z.string(),
          origem: z.string(),
          quando: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ context }) => {
    const linhas = await prisma.astroMemoria.findMany({
      where: { organizationId: context.org.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        chave: true,
        texto: true,
        origem: true,
        updatedAt: true,
      },
    });
    return {
      memorias: linhas.map((linha) => ({
        id: linha.id,
        chave: linha.chave,
        texto: linha.texto,
        origem: linha.origem,
        quando: linha.updatedAt.toISOString(),
      })),
    };
  });

/** Apagar um fato pela tela. O id é revalidado contra a organização. */
export const esquecerMemoria = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string().min(1) }))
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const memoria = await prisma.astroMemoria.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!memoria) throw errors.NOT_FOUND({ message: "Memória não encontrada" });

    await prisma.astroMemoria.delete({ where: { id: memoria.id } });
    return { ok: true };
  });
