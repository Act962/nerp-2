import "server-only";
import { SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";

/**
 * Pedido do Catálogo Online que nasce `PENDING_APPROVAL`.
 *
 * É o miolo dos modos APPROVAL (o operador aprova no PDV) e ORBITA (o Órbita
 * negocia, cobra e confirma de volta): nos dois, nada é cobrado aqui, não há
 * baixa de estoque e a venda só existe como pedido. Quem chama já resolveu a
 * organização pelo `subdomain` público e validou o modo do catálogo.
 */

export type PendingSaleErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_REQUIRED"
  | "PRODUCTS_UNAVAILABLE";

/** Erro de regra que a procedure traduz para o `errors` tipado do oRPC. */
export class PendingSaleError extends Error {
  constructor(
    readonly code: PendingSaleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PendingSaleError";
  }
}

export type CreatePendingSaleInput = {
  organizationId: string;
  products: Array<{ id: string; quantity: number }>;
  /** Id do `CatalogUser` logado no catálogo. */
  customerId?: string;
  guest?: { name: string; phone?: string };
  /**
   * Telefone de contato exigido por quem precisa falar com o cliente (ORBITA).
   * Vai para o `Customer` quando ele ainda não tem telefone.
   */
  contactPhone?: string;
  notes?: string;
  /** Nota da venda quando o cliente não escreveu observação. */
  defaultSaleNote: string;
  /** Nota gravada no `Customer` criado a partir do convidado. */
  newCustomerNote: string;
};

export type PendingSaleResult = { saleId: string; saleNumber: number };

async function resolveCustomerId(
  input: CreatePendingSaleInput,
): Promise<string> {
  // Cliente logado no catálogo: usa o Customer real vinculado ao CatalogUser.
  if (input.customerId) {
    const catalogUser = await prisma.catalogUser.findUnique({
      where: { id: input.customerId },
      include: { customer: true },
    });
    if (!catalogUser?.customer) {
      throw new PendingSaleError(
        "CUSTOMER_NOT_FOUND",
        "Cliente não encontrado!",
      );
    }
    const contactPhone = input.contactPhone?.trim();
    if (contactPhone && !catalogUser.customer.phone) {
      await prisma.customer.update({
        where: { id: catalogUser.customer.id },
        data: { phone: contactPhone },
      });
    }
    return catalogUser.customer.id;
  }

  // Convidado: reusa o Customer walk-in pelo telefone quando existir, para
  // clientes recorrentes não encherem a base e o operador enxergar histórico.
  if (input.guest) {
    const phone = input.guest.phone?.trim() || null;
    const existing = phone
      ? await prisma.customer.findFirst({
          where: { organizationId: input.organizationId, phone },
          select: { id: true },
        })
      : null;

    if (existing) {
      // O cliente pode ter digitado o nome completo desta vez.
      await prisma.customer.update({
        where: { id: existing.id },
        data: { name: input.guest.name },
      });
      return existing.id;
    }

    const created = await prisma.customer.create({
      data: {
        organizationId: input.organizationId,
        name: input.guest.name,
        phone,
        notes: input.newCustomerNote,
      },
      select: { id: true },
    });
    return created.id;
  }

  throw new PendingSaleError("CUSTOMER_REQUIRED", "Cliente não informado.");
}

export async function createPendingSale(
  input: CreatePendingSaleInput,
): Promise<PendingSaleResult> {
  const customerId = await resolveCustomerId(input);

  const productIds = input.products.map((product) => product.id);
  // Produtos sem controle de estoque (trackStock=false) não bloqueiam por
  // currentStock — a disponibilidade é confirmada depois.
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      organizationId: input.organizationId,
      isActive: true,
      OR: [{ trackStock: false }, { currentStock: { gte: 1 } }],
    },
  });

  if (products.length !== input.products.length) {
    throw new PendingSaleError(
      "PRODUCTS_UNAVAILABLE",
      "Alguns produtos não foram encontrados ou estão sem estoque!",
    );
  }

  // Preço resolvido pelo server via `priceListId` do Customer. Convidado sem
  // tabela cai na default da org.
  const customerForPricing = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: input.organizationId },
    select: { priceListId: true },
  });
  const resolved = await resolveManyPrices({
    organizationId: input.organizationId,
    priceListId: customerForPricing?.priceListId ?? null,
    items: input.products.map((product) => ({
      productId: product.id,
      quantity: product.quantity,
    })),
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  const items = input.products.map((inputProduct, index) => {
    const product = productById.get(inputProduct.id);
    if (!product) {
      throw new PendingSaleError(
        "PRODUCTS_UNAVAILABLE",
        "Alguns produtos não foram encontrados ou estão sem estoque!",
      );
    }
    const unitPrice = resolved[index].unitPrice;
    return {
      productId: product.id,
      productName: product.name,
      quantity: inputProduct.quantity,
      unitPrice,
      total: unitPrice * inputProduct.quantity,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const usedPriceListId = resolved[0]?.priceListId ?? null;

  // Numeração atômica (evita corrida com o count() usado no PDV).
  const organization = await prisma.organization.update({
    where: { id: input.organizationId },
    data: { lastSaleNumber: { increment: 1 } },
    select: { lastSaleNumber: true },
  });

  const sale = await prisma.sale.create({
    data: {
      organizationId: input.organizationId,
      customerId,
      priceListId: usedPriceListId,
      subtotal,
      total: subtotal,
      saleNumber: organization.lastSaleNumber,
      status: SaleStatus.PENDING_APPROVAL,
      notes: input.notes ?? input.defaultSaleNote,
      items: {
        createMany: { data: items },
      },
    },
    select: { id: true, saleNumber: true },
  });

  return { saleId: sale.id, saleNumber: sale.saleNumber };
}
