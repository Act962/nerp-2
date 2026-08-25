import { getOrderUrgency } from "@/utils/pedidos-config";

export type WaiterOrder = {
  id: string;
  tableNumber: string;
  dishName: string;
  notes: string | null;
  columnId: string;
  columnName: string;
  columnColor: string;
  columnIsInitial: boolean;
  columnIsFinal: boolean;
  columnShowOnTv: boolean;
  estimatedMinutes: number | null;
  createdAt: string;
  columnEnteredAt: string;
  archivedAt: string | null;
};

export type Tab = "todos" | "emPreparo" | "atrasados" | "prontos" | "concluidos";

export function categorize(order: WaiterOrder, now: number) {
  const isReady = order.columnShowOnTv && !order.archivedAt;
  const isDone = order.columnIsFinal || order.archivedAt != null;
  const isOverdue =
    !isDone &&
    getOrderUrgency(order.createdAt, order.estimatedMinutes, now) === "overdue";
  const isInProgress = !isReady && !isDone;
  return { isReady, isDone, isOverdue, isInProgress };
}

export function countTabs(orders: WaiterOrder[], now: number) {
  let emPreparo = 0;
  let atrasados = 0;
  let prontos = 0;
  let concluidos = 0;
  for (const o of orders) {
    const c = categorize(o, now);
    if (c.isInProgress) emPreparo++;
    if (c.isOverdue) atrasados++;
    if (c.isReady) prontos++;
    if (c.isDone) concluidos++;
  }
  return {
    todos: orders.length,
    emPreparo,
    atrasados,
    prontos,
    concluidos,
  } as Record<Tab, number>;
}

export function filterByTab(
  orders: WaiterOrder[],
  tab: Tab,
  now: number,
): WaiterOrder[] {
  if (tab === "todos") return orders;
  return orders.filter((o) => {
    const c = categorize(o, now);
    if (tab === "emPreparo") return c.isInProgress;
    if (tab === "atrasados") return c.isOverdue;
    if (tab === "prontos") return c.isReady;
    return c.isDone;
  });
}
