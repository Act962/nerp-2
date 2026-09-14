import { randomUUID } from "node:crypto";
import { CatalogOperationMode } from "@/generated/prisma/enums";
import prisma from "@/lib/db";

/**
 * Cria pedidos na cozinha (KDS) a partir de uma venda confirmada.
 *
 * Chamado pelos webhooks de pagamento (Stripe/Asaas) logo após a `Sale` ser criada.
 * Só age quando o catálogo da organização está no modo KITCHEN — no modo
 * MARKETPLACE (padrão) é um no-op, preservando o comportamento de e-commerce.
 *
 * Gera 1 `KitchenOrder` por item da venda, na coluna de entrada (isInitial) da org,
 * todos sob o mesmo `ticketId` — é esse agrupamento que vira um cupom só e uma
 * tela de acompanhamento só.
 * É tolerante a falhas (não lança): a venda já existe e o pagamento não deve
 * falhar por causa de um problema na cozinha. Os webhooks devem chamar dentro de
 * try/catch mesmo assim, por garantia.
 *
 * `requiresAcceptance` nasce FALSE de propósito: os chamadores de hoje são os
 * webhooks de pagamento, e pedido já pago não pode ficar esperando alguém
 * clicar "aceitar". Só o cardápio sem pagamento online passa true.
 */
export async function createKitchenOrdersFromSale(
  saleId: string,
  options: { requiresAcceptance?: boolean } = {},
) {
  const requiresAcceptance = options.requiresAcceptance ?? false;
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
          notes: true,
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
    select: { id: true },
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

  // 5. Identificação do card. O cabeçalho do pedido (número + cliente) vai no
  // tableNumber, que já é texto livre e aparece em destaque no board, na TV e na
  // busca. `notes` fica reservado ao que o cliente pediu para ESTE item ("sem
  // cebola") — antes os dois significados dividiam o mesmo campo e a observação
  // do pedido era repetida em todos os itens.
  const tableNumber = [`Pedido #${sale.saleNumber}`, sale.customer?.name]
    .filter(Boolean)
    .join(" · ");

  const ticketId = randomUUID();
  const acceptedAt = requiresAcceptance ? null : new Date();

  const data = sale.items.map((item, index) => {
    const quantity = Number(item.quantity);
    const dishName =
      quantity > 1 ? `${quantity}x ${item.productName}` : item.productName;

    // A observação geral da venda cabe no primeiro item: é onde a cozinha lê.
    const notes = [item.notes, index === 0 && sale.notes ? sale.notes : null]
      .filter(Boolean)
      .join(" · ");

    return {
      organizationId,
      columnId: column.id,
      tableNumber,
      dishName,
      productId: item.productId,
      estimatedMinutes: prepTimeByProduct.get(item.productId) ?? null,
      notes: notes || null,
      position: position++,
      columnEnteredAt: new Date(),
      ticketId,
      acceptedAt,
      saleId: sale.id,
    };
  });

  await prisma.kitchenOrder.createMany({ data });

  return ticketId;
}
