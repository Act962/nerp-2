import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import z from "zod";

// Público: a página de aceite precisa mostrar o convite antes do login, e o id
// do convite é a própria credencial (cuid não adivinhável).
export const getInvitation = base
  .route({
    method: "GET",
    summary: "Ler um convite pelo id",
    tags: ["invitations"],
  })
  .input(z.object({ id: z.string() }))
  .output(
    z.object({
      id: z.string(),
      email: z.string(),
      role: z.string(),
      status: z.string(),
      isExpired: z.boolean(),
      expiresAt: z.string(),
      organizationName: z.string(),
      organizationLogo: z.string().nullable(),
      inviterName: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const invitation = await prisma.invitation.findUnique({
      where: { id: input.id },
      include: {
        organization: { select: { name: true, logo: true } },
        user: { select: { name: true } },
      },
    });

    if (!invitation) {
      throw errors.NOT_FOUND({ message: "Convite não encontrado." });
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role ?? "member",
      status: invitation.status,
      isExpired: invitation.expiresAt.getTime() < Date.now(),
      expiresAt: invitation.expiresAt.toISOString(),
      organizationName: invitation.organization.name,
      organizationLogo: invitation.organization.logo ?? null,
      inviterName: invitation.user.name,
    };
  });
