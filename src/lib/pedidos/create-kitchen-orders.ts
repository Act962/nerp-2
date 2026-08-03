import prisma from "@/lib/db";
import {
  KitchenOrderActorType,
  KitchenOrderEventType,
} from "@/generated/prisma/enums";
import { recordOrderEvent } from "./order-events";

export type CreateKitchenOrderItem = {
  dishName: string;
  productId?: string;
  quantity: number;
  estimatedMinutes?: number;
  notes?: string;
};

export type CreateKitchenOrdersActor =
  | { type: "USER"; userId: string; name: string; photoUrl?: string | null }
  | {
      type: "WAITER";
      collaboratorId: string;
      name: string;
      photoUrl?: string | null;
    };

export type CreateKitchenOrdersInput = {
  organizationId: string;
  tableNumber: string;
  columnId?: string;
  attendantId: string;
  items: CreateKitchenOrderItem[];
  createdById?: string | null;
  actor?: CreateKitchenOrdersActor;
};

export type CreateKitchenOrdersResult =
  | { ok: true; count: number }
  | { ok: false; reason: "column-not-found" | "attendant-not-found" };

export async function createKitchenOrders(
  input: CreateKitchenOrdersInput,
): Promise<CreateKitchenOrdersResult> {
  const { organizationId } = input;

  const column = input.columnId
    ? await prisma.kitchenColumn.findFirst({
        where: { id: input.columnId, organizationId },
        select: { id: true, name: true },
      })
    : await prisma.kitchenColumn.findFirst({
        where: { organizationId, isInitial: true },
        select: { id: true, name: true },
      });

  if (!column) return { ok: false, reason: "column-not-found" };

  const attendant = await prisma.collaborator.findFirst({
    where: { id: input.attendantId, organizationId, isActive: true },
    select: { id: true, name: true, photoUrl: true },
  });

  if (!attendant) return { ok: false, reason: "attendant-not-found" };

  const productIds = input.items
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));

  const prepTimeByProduct = new Map<string, number | null>();
  if (productIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, organizationId },
      select: { id: true, prepTimeMinutes: true },
    });
    for (const product of products) {
      prepTimeByProduct.set(product.id, product.prepTimeMinutes);
    }
  }

  const last = await prisma.kitchenOrder.aggregate({
    where: { columnId: column.id },
    _max: { position: true },
  });
  let position = (last._max.position ?? -1) + 1;

  const columnEnteredAt = new Date();

  const data = input.items.map((item) => {
    const estimatedMinutes =
      item.estimatedMinutes ??
      (item.productId ? (prepTimeByProduct.get(item.productId) ?? null) : null);

    const dishName =
      item.quantity > 1 ? `${item.quantity}x ${item.dishName}` : item.dishName;

    return {
      organizationId,
      columnId: column.id,
      tableNumber: input.tableNumber,
      dishName,
      productId: item.productId,
      estimatedMinutes,
      notes: item.notes,
      attendantId: attendant.id,
      attendantName: attendant.name,
      attendantPhoto: attendant.photoUrl,
      position: position++,
      columnEnteredAt,
      createdById: input.createdById ?? undefined,
    };
  });

  // createManyAndReturn devolve as linhas para podermos emitir um evento por
  // pedido criado com o id real (histórico granular).
  const created = await prisma.kitchenOrder.createManyAndReturn({ data });

  const actor = input.actor;
  if (actor) {
    await Promise.all(
      created.map((order) =>
        recordOrderEvent({
          type: KitchenOrderEventType.CREATED,
          order: {
            id: order.id,
            organizationId: order.organizationId,
            tableNumber: order.tableNumber,
            dishName: order.dishName,
            attendantId: order.attendantId,
            attendantName: order.attendantName,
            attendantPhoto: order.attendantPhoto,
          },
          toColumn: { id: column.id, name: column.name },
          actor:
            actor.type === "USER"
              ? {
                  type: KitchenOrderActorType.USER,
                  userId: actor.userId,
                  name: actor.name,
                  photoUrl: actor.photoUrl ?? null,
                }
              : {
                  type: KitchenOrderActorType.WAITER,
                  collaboratorId: actor.collaboratorId,
                  name: actor.name,
                  photoUrl: actor.photoUrl ?? null,
                },
        }),
      ),
    );
  }

  return { ok: true, count: created.length };
}
