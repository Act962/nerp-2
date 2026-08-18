import z from "zod";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";

/**
 * Dados mínimos do convite para a página pública, ANTES do login.
 *
 * Sem middleware de auth de propósito: quem abre o link ainda pode nem ter
 * conta. Devolve só o suficiente para a pessoa reconhecer a empresa (nome e
 * logo) — nada de contagem de membros, plano ou lista de gente. Token
 * inválido, revogado ou vencido responde igual: "link inválido".
 */
export const previewJoinLink = base
  .route({
    method: "GET",
    summary: "Prévia pública do link de entrada",
    tags: ["invitations"],
  })
  .input(z.object({ token: z.string().min(8) }))
  .handler(async ({ input, errors }) => {
    const link = await prisma.organizationJoinLink.findUnique({
      where: { token: input.token },
      select: {
        expiresAt: true,
        organization: { select: { id: true, name: true, logo: true } },
      },
    });

    if (!link || (link.expiresAt && link.expiresAt.getTime() < Date.now())) {
      throw errors.NOT_FOUND({ message: "Link inválido ou expirado." });
    }

    return {
      organizationId: link.organization.id,
      organizationName: link.organization.name,
      organizationLogo: link.organization.logo,
    };
  });
