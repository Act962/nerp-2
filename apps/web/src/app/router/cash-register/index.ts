import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";
import { z } from "zod";
import { getCaixaMember } from "../caixa/_access";

const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

const registerOutput = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
});

// Só owner/admin gerenciam os terminais (é configuração da loja).
async function requireManage(
  orgId: string,
  userId: string,
  errors: { FORBIDDEN: (o: { message: string }) => Error },
) {
  const member = await getCaixaMember(orgId, userId);
  if (!member || !hasFullAccess(member.role))
    throw errors.FORBIDDEN({
      message: "Apenas owner/admin podem gerenciar caixas",
    });
}

// Lista os caixas (terminais). Qualquer membro lê — o seletor de abertura usa.
const listRegisters = p
  .input(z.object({ includeInactive: z.boolean().optional() }).optional())
  .output(z.object({ registers: z.array(registerOutput) }))
  .handler(async ({ input, context }) => {
    const registers = await prisma.cashRegister.findMany({
      where: {
        organizationId: context.org.id,
        ...(input?.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true },
    });
    return { registers };
  });

const createRegister = p
  .input(z.object({ name: z.string().min(1, "Informe o nome do caixa") }))
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    const created = await prisma.cashRegister.create({
      data: { organizationId: context.org.id, name: input.name.trim() },
      select: { id: true },
    });
    return created;
  });

const updateRegister = p
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    const register = await prisma.cashRegister.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true },
    });
    if (!register) throw errors.NOT_FOUND({ message: "Caixa não encontrado" });
    await prisma.cashRegister.update({
      where: { id: input.id },
      data: { name: input.name?.trim(), isActive: input.isActive },
    });
    return { ok: true };
  });

const deleteRegister = p
  .input(z.object({ id: z.string() }))
  .output(z.object({ ok: z.boolean(), deactivated: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    await requireManage(context.org.id, context.user.id, errors);
    const register = await prisma.cashRegister.findFirst({
      where: { id: input.id, organizationId: context.org.id },
      select: { id: true, _count: { select: { sessions: true } } },
    });
    if (!register) throw errors.NOT_FOUND({ message: "Caixa não encontrado" });

    // Com histórico de sessões, apenas desativa (preserva os relatórios).
    if (register._count.sessions > 0) {
      await prisma.cashRegister.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { ok: true, deactivated: true };
    }
    await prisma.cashRegister.delete({ where: { id: input.id } });
    return { ok: true, deactivated: false };
  });

export const cashRegisterRoutes = {
  list: listRegisters,
  create: createRegister,
  update: updateRegister,
  delete: deleteRegister,
};
