import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";

/**
 * Marcar aviso como lido, ou como já falado pelo mascote.
 *
 * O id vem do cliente, então ele é revalidado contra a organização: sem o
 * `findFirst` com `organizationId`, um id adivinhado marcaria o aviso da
 * empresa vizinha — e o `updateMany` por id sozinho não protegeria nada.
 */
const marcarCampo = (campo: "lidoEm" | "faladoEm") =>
  base
    .use(requireAuthMiddleware)
    .use(requireOrgMiddleware)
    .input(z.object({ id: z.string().min(1) }))
    .output(z.object({ ok: z.boolean() }))
    .handler(async ({ input, context, errors }) => {
      const aviso = await prisma.astroAviso.findFirst({
        where: { id: input.id, organizationId: context.org.id },
        select: { id: true },
      });
      if (!aviso) throw errors.NOT_FOUND({ message: "Aviso não encontrado" });

      await prisma.astroAviso.update({
        where: { id: aviso.id },
        data: { [campo]: new Date() },
      });
      return { ok: true };
    });

export const marcarLido = marcarCampo("lidoEm");
export const marcarFalado = marcarCampo("faladoEm");

/** Limpar o selo de uma vez, quando alguém abre a central. */
export const marcarTodosLidos = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}))
  .output(z.object({ marcados: z.number() }))
  .handler(async ({ context }) => {
    const { count } = await prisma.astroAviso.updateMany({
      where: { organizationId: context.org.id, lidoEm: null },
      data: { lidoEm: new Date() },
    });
    return { marcados: count };
  });
