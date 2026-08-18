import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Sigla curta da rede usada no Digital Space ID (ex.: "WS"). Fica em Configurações
// porque é identidade da organização, não de uma loja específica.
export const updateOrgSigla = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ sigla: z.string().trim().max(8).nullable() }))
  .output(z.object({ sigla: z.string().nullable() }))
  .handler(async ({ input, context }) => {
    const organization = await prisma.organization.update({
      where: { id: context.org.id },
      data: { sigla: input.sigla || null },
      select: { sigla: true },
    });
    return { sigla: organization.sigla };
  });
