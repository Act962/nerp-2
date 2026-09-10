import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireVerifiedOrgMiddleware } from "@/app/middlewares/verified-org";
import { validarSubdominio } from "@/features/organization/lib/subdominio";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";

/**
 * Troca o subdomínio da vitrine.
 *
 * É o endereço público da loja no domínio da plataforma: só administrador
 * mexe, e nome reservado (`www`, `api`, `login`…) nunca entra — o
 * `middleware.ts` reescreve qualquer subdomínio para a vitrine, e quem
 * registrasse `api` receberia o tráfego que parece ser nosso.
 */
export const updateSubdomain = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireVerifiedOrgMiddleware("publicar a loja online"))
  .route({
    method: "POST",
    path: "/update-subdomain",
    summary: "Update subdomain",
    description: "Update the subdomain of the organization",
    tags: ["Organization"],
  })
  .input(
    z.object({
      subdomain: z.string().min(3).max(63),
    }),
  )
  .output(
    z.object({
      organizationId: z.string(),
      subdomain: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!(await isOrgAdmin(context.org.id, context.user.id))) {
      throw errors.FORBIDDEN({
        message: "Apenas administradores alteram o subdomínio da loja.",
      });
    }

    const validacao = validarSubdominio(input.subdomain);
    if (!validacao.ok) {
      throw errors.BAD_REQUEST({ message: validacao.motivo });
    }
    const subdomain = validacao.subdominio;

    const existing = await prisma.organization.findUnique({
      where: { subdomain },
      select: { id: true },
    });

    if (existing && existing.id !== context.org.id) {
      throw errors.BAD_REQUEST({ message: "Subdomínio indisponível" });
    }

    const updated = await prisma.organization.update({
      where: { id: context.org.id },
      data: { subdomain },
      select: { id: true },
    });

    return { organizationId: updated.id, subdomain };
  });
