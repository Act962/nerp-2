import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { validarSubdominio } from "@/features/organization/lib/subdominio";
import prisma from "@/lib/db";

export const checkSubdomain = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/check-subdomain",
    summary: "Check subdomain availability",
    description: "Check if a subdomain is available for use.",
    tags: ["Organization"],
  })
  .input(
    z.object({
      subdomain: z.string().min(3).max(63),
    }),
  )
  .output(
    z.object({
      available: z.boolean(),
      message: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    // A mesma régua do `updateSubdomain`: a tela não pode dizer "disponível"
    // para um nome que o servidor vai recusar.
    const validacao = validarSubdominio(input.subdomain);
    if (!validacao.ok) {
      return { available: false, message: validacao.motivo };
    }

    const existing = await prisma.organization.findUnique({
      where: { subdomain: validacao.subdominio },
      select: { id: true },
    });

    const isAvailableToUse = !existing || existing.id === context.org.id;

    return {
      available: isAvailableToUse,
      message: isAvailableToUse
        ? "Subdomínio disponível"
        : "Subdomínio indisponível",
    };
  });
