import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { z } from "zod";

// Logo da organização (chave R2). O upload em si passa pelo fluxo presignado
// (/api/s3/upload) no cliente; aqui só gravamos a chave resultante. `null`
// remove a logo (volta pro fallback de iniciais).
export const updateOrgLogo = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ logo: z.string().trim().min(1).nullable() }))
  .output(z.object({ logo: z.string().nullable() }))
  .handler(async ({ input, context }) => {
    const organization = await prisma.organization.update({
      where: { id: context.org.id },
      data: { logo: input.logo || null },
      select: { logo: true },
    });
    return { logo: organization.logo };
  });
