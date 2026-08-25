import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { PAGE_PERMISSION_KEYS } from "@/lib/permissions";
import z from "zod";

const validKeys = new Set(PAGE_PERMISSION_KEYS);

export const updateMemberPermissions = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Atualizar permissões de um membro",
    tags: ["members"],
  })
  .input(
    z.object({
      memberId: z.string(),
      permissions: z.array(z.string()),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ context, input, errors }) => {
    const member = await prisma.member.findFirst({
      where: { id: input.memberId, organizationId: context.org.id },
      select: { id: true },
    });

    if (!member) {
      throw errors.NOT_FOUND({ message: "Membro não encontrado!" });
    }

    // Aceita só chaves conhecidas para evitar dados quaisquer no array.
    const sanitized = Array.from(
      new Set(input.permissions.filter((p) => validKeys.has(p as never))),
    );

    await prisma.member.update({
      where: { id: input.memberId },
      data: { permissions: sanitized },
    });

    return { success: true };
  });
