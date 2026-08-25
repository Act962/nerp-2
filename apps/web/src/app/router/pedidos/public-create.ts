import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { createKitchenOrders } from "@/lib/pedidos/create-kitchen-orders";
import z from "zod";

// Rota pública (sem requireAuth): a confiança vem do orgSlug + attendantId,
// mesmo modelo do painel TV. Permite criar pedidos a partir do app do garçom
// sem login Better Auth. Não permite mover/arquivar — só criar.
export const publicCreate = base
  .route({
    method: "POST",
    summary: "Registrar pedidos (kiosk do garçom)",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      orgSlug: z.string().min(1),
      attendantId: z.string().min(1),
      tableNumber: z.string().min(1),
      items: z
        .array(
          z.object({
            dishName: z.string().min(1),
            productId: z.string().optional(),
            quantity: z.number().int().positive().default(1),
            estimatedMinutes: z.number().int().positive().optional(),
            notes: z.string().optional(),
          }),
        )
        .min(1),
    }),
  )
  .output(z.object({ count: z.number() }))
  .handler(async ({ input, errors }) => {
    const org = await prisma.organization.findUnique({
      where: { slug: input.orgSlug },
      select: { id: true },
    });

    if (!org) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    const attendant = await prisma.collaborator.findFirst({
      where: { id: input.attendantId, organizationId: org.id, isActive: true },
      select: { id: true, name: true, photoUrl: true },
    });

    const result = await createKitchenOrders({
      organizationId: org.id,
      tableNumber: input.tableNumber,
      attendantId: input.attendantId,
      items: input.items,
      actor: attendant
        ? {
            type: "WAITER",
            collaboratorId: attendant.id,
            name: attendant.name,
            photoUrl: attendant.photoUrl,
          }
        : undefined,
    });

    if (!result.ok) {
      throw errors.BAD_REQUEST({
        message:
          result.reason === "column-not-found"
            ? "Nenhuma coluna de entrada configurada para a cozinha!"
            : "Atendente não encontrado!",
      });
    }

    return { count: result.count };
  });
