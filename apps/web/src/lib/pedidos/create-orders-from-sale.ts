import {
  CatalogOperationMode,
  KitchenOrderActorType,
  KitchenOrderEventType,
} from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { recordOrderEvent } from "./order-events";

/**
 * Cria pedidos na cozinha (KDS) a partir de uma venda confirmada.
 *
 * Chamado pelos webhooks de pagamento (Stripe/Asaas) logo após a `Sale` ser criada.
 * Só age quando o catálogo da organização está no modo KITCHEN — no modo
 * MARKETPLACE (padrão) é um no-op, preservando o comportamento de e-commerce.
 *
 * Gera 1 `KitchenOrder` por item da venda, na coluna de entrada (isInitial) da org,
 * com `saleId` apontando para a venda — é o que deixa o card mostrar
 * "Catálogo #N" e o /pedidos cruzar cozinha e catálogo.
 * É tolerante a falhas (não lança): a venda já existe e o pagamento não deve
 * falhar por causa de um problema na cozinha. Os webhooks devem chamar dentro de
 * try/catch mesmo assim, por garantia.
 */
export async function createKitchenOrdersFromSale(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      organizationId: true,
      saleNumber: true,
      notes: true,
      customer: { select: { name: true } },
      items: {
        select: {
          productId: true,
          productName: true,
          quantity: true,
        },
      },
    },
  });

  if (!sale || sale.items.length === 0) return;

  const organizationId = sale.organizationId;

  // 1. Só prossegue se o catálogo estiver no modo Cozinha.
  const settings = await prisma.catalogSettings.findUnique({
    where: { organizationId },
    select: { operationMode: true },
  });

  if (settings?.operationMode !== CatalogOperationMode.KITCHEN) return;

  // 2. Resolve a coluna de entrada (isInitial) da org.
  const column = await prisma.kitchenColumn.findFirst({
    where: { organizationId, isInitial: true },
    select: { id: true, name: true },
  });

  if (!column) {
    console.warn(
      `[kitchen] Nenhuma coluna inicial configurada para a org ${organizationId}; pedido da venda ${sale.saleNumber} não enviado à cozinha.`,
    );
    return;
  }

  // 3. Tempo de preparo: snapshot do prepTimeMinutes de cada produto.
  const productIds = sale.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId },
    select: { id: true, prepTimeMinutes: true },
  });
  const prepTimeByProduct = new Map(
    products.map((p) => [p.id, p.prepTimeMinutes]),
  );

  // 4. Posição inicial na coluna (incrementa por item).
  const last = await prisma.kitchenOrder.aggregate({
    where: { columnId: column.id },
    _max: { position: true },
  });
  let position = (last._max.position ?? -1) + 1;

  // 5. Identificação do card: "Pedido #<saleNumber>" + cliente/observações nas notes.
  const tableNumber = `Pedido #${sale.saleNumber}`;
  const baseNote = [
    sale.customer?.name ? `Cliente: ${sale.customer.name}` : null,
    sale.notes ? `Obs: ${sale.notes}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const data = sale.items.map((item) => {
    const quantity = Number(item.quantity);
    const dishName =
      quantity > 1 ? `${quantity}x ${item.productName}` : item.productName;

    return {
      organizationId,
      columnId: column.id,
      tableNumber,
      dishName,
      productId: item.productId,
      saleId: sale.id,
      estimatedMinutes: prepTimeByProduct.get(item.productId) ?? null,
      notes: baseNote || null,
      position: position++,
      columnEnteredAt: new Date(),
    };
  });

  const created = await prisma.kitchenOrder.createManyAndReturn({ data });

  await Promise.all(
    created.map((order) =>
      recordOrderEvent({
        type: KitchenOrderEventType.CREATED,
        order: {
          id: order.id,
          organizationId: order.organizationId,
          tableNumber: order.tableNumber,
          dishName: order.dishName,
        },
        toColumn: { id: column.id, name: column.name },
        actor: {
          type: KitchenOrderActorType.SYSTEM,
          name: "Catálogo online",
        },
      }),
    ),
  );
}
