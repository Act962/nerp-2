import prisma from "@/lib/db";
import {
  KitchenOrderActorType,
  KitchenOrderEventType,
} from "@/generated/prisma/enums";

type ActorInput =
  | {
      type: typeof KitchenOrderActorType.USER;
      userId: string;
      name: string;
      photoUrl?: string | null;
    }
  | {
      type: typeof KitchenOrderActorType.WAITER;
      collaboratorId: string;
      name: string;
      photoUrl?: string | null;
    }
  | {
      type: typeof KitchenOrderActorType.SYSTEM;
      name?: string;
    };

interface OrderSnapshot {
  id: string;
  organizationId: string;
  tableNumber: string;
  dishName: string;
  attendantId?: string | null;
  attendantName?: string | null;
  attendantPhoto?: string | null;
}

interface ColumnSnapshot {
  id: string;
  name: string;
}

interface RecordEventInput {
  type: KitchenOrderEventType;
  order: OrderSnapshot;
  fromColumn?: ColumnSnapshot | null;
  toColumn?: ColumnSnapshot | null;
  actor: ActorInput;
}

// Grava um evento de auditoria do pedido. Erros silenciados — o histórico é
// best-effort e não pode bloquear a mutação principal.
export async function recordOrderEvent(input: RecordEventInput): Promise<void> {
  try {
    const actorBase = (() => {
      if (input.actor.type === KitchenOrderActorType.USER) {
        return {
          actorType: KitchenOrderActorType.USER,
          actorUserId: input.actor.userId,
          actorCollaboratorId: null,
          actorName: input.actor.name,
          actorPhotoUrl: input.actor.photoUrl ?? null,
        };
      }
      if (input.actor.type === KitchenOrderActorType.WAITER) {
        return {
          actorType: KitchenOrderActorType.WAITER,
          actorUserId: null,
          actorCollaboratorId: input.actor.collaboratorId,
          actorName: input.actor.name,
          actorPhotoUrl: input.actor.photoUrl ?? null,
        };
      }
      return {
        actorType: KitchenOrderActorType.SYSTEM,
        actorUserId: null,
        actorCollaboratorId: null,
        actorName: input.actor.name ?? "Sistema",
        actorPhotoUrl: null,
      };
    })();

    await prisma.kitchenOrderEvent.create({
      data: {
        organizationId: input.order.organizationId,
        orderId: input.order.id,
        type: input.type,
        tableNumber: input.order.tableNumber,
        dishName: input.order.dishName,
        fromColumnId: input.fromColumn?.id ?? null,
        fromColumnName: input.fromColumn?.name ?? null,
        toColumnId: input.toColumn?.id ?? null,
        toColumnName: input.toColumn?.name ?? null,
        attendantId: input.order.attendantId ?? null,
        attendantName: input.order.attendantName ?? null,
        attendantPhoto: input.order.attendantPhoto ?? null,
        ...actorBase,
      },
    });
  } catch (error) {
    console.error("[order-events] falhou ao gravar evento:", error);
  }
}

// Classifica um evento de movimento conforme as flags da coluna destino.
// Se o pedido entrou em coluna showOnTv → READY. Em isFinal → DELIVERED.
// Caso contrário, MOVED.
export function classifyMoveEvent(toColumn: {
  isFinal: boolean;
  showOnTv: boolean;
}): KitchenOrderEventType {
  if (toColumn.isFinal) return KitchenOrderEventType.DELIVERED;
  if (toColumn.showOnTv) return KitchenOrderEventType.READY;
  return KitchenOrderEventType.MOVED;
}
