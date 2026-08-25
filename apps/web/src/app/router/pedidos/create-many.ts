import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { createKitchenOrders } from "@/lib/pedidos/create-kitchen-orders";
import z from "zod";

export const createKitchenOrderMany = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Registrar vários pedidos na cozinha (mesma mesa)",
    tags: ["kitchen"],
  })
  .input(
    z.object({
      tableNumber: z.string().min(1),
      columnId: z.string().optional(), // padrão: a coluna isInitial da org
      attendantId: z.string().min(1, "Informe o atendente"),
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
  .handler(async ({ context, input, errors }) => {
    const result = await createKitchenOrders({
      organizationId: context.org.id,
      tableNumber: input.tableNumber,
      columnId: input.columnId,
      attendantId: input.attendantId,
      items: input.items,
      createdById: context.session.userId,
      actor: {
        type: "USER",
        userId: context.user.id,
        name: context.user.name ?? context.user.email ?? "Usuário",
        photoUrl: context.user.image ?? null,
      },
    });

    if (!result.ok) {
      throw errors.BAD_REQUEST({
        message:
          result.reason === "column-not-found"
            ? input.columnId
              ? "Coluna não encontrada!"
              : "Nenhuma coluna de entrada configurada para a cozinha!"
            : "Atendente não encontrado!",
      });
    }

    return { count: result.count };
  });
