import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import z from "zod";

export const updateMemberSupervisor = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Definir o supervisor de um membro (promotor)",
    tags: ["members"],
  })
  .input(
    z.object({
      memberId: z.string(),
      supervisorId: z.string().nullable(),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    if (input.supervisorId === input.memberId) {
      throw errors.BAD_REQUEST({
        message: "Um membro não pode ser supervisor de si mesmo",
      });
    }

    const member = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true },
    });

    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado!" });
    }

    // O supervisor precisa ser membro da mesma organização (isolamento multi-tenant).
    if (input.supervisorId) {
      const supervisor = await prisma.member.findFirst({
        where: { id: input.supervisorId, organizationId: context.org.id },
        select: { id: true },
      });

      if (!supervisor) {
        throw errors.NOT_FOUND({ message: "Supervisor não encontrado!" });
      }
    }

    await prisma.member.update({
      where: { id: input.memberId },
      data: { supervisorId: input.supervisorId },
    });

    return { success: true };
  });
