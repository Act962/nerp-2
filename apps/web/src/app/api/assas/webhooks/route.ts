import { SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { createKitchenOrdersFromSale } from "@/lib/pedidos/create-orders-from-sale";
import type { AsaasCheckoutEventType } from "@/schemas/assas";
import { NextResponse } from "next/server";

/**
 * Tipagem principal do Webhook
 */
interface Items {
  name: string;
  description: string;
  quantity: number;
  externalReference: string;
  value: number;
}

interface AsaasCheckoutWebhook {
  id: string;
  event: AsaasCheckoutEventType;
  dateCreated: string;
  account: {
    id: string;
    ownerId: string | null;
  };
  checkout: {
    id: string;
    status: string;
    link: string | null;
    minutesToExpire: number;
    externalReference: string;
    billingTypes: string[];
    chargeTypes: string[];
    items: Items[];
    customer: string | null;
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AsaasCheckoutWebhook;

    console.log("🔔 Webhook Asaas recebido:", body.event);

    // Garantia mínima de segurança
    if (!body?.event || !body?.checkout?.id) {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    switch (body.event) {
      case "CHECKOUT_PAID": {
        if (!body.checkout.externalReference.split("-")[0]) {
          throw new Error("Customer ID is required");
        }

        const customer = await prisma.customer.findUnique({
          where: {
            id: body.checkout.externalReference.split("-")[0],
          },
        });

        if (!customer) {
          throw new Error("User not found");
        }

        if (!body.checkout.externalReference.split("-")[1]) {
          throw new Error("Organization ID is required");
        }
        const organization = await prisma.organization.findUnique({
          where: {
            id: body.checkout.externalReference.split("-")[1],
          },
        });

        if (!organization) {
          throw new Error("Organization not found");
        }

        const items = body.checkout.items;

        const subtotal = items.reduce(
          (acc, item) => acc + item.quantity * item.value,
          0,
        );

        const total = subtotal;

        const lastSale = await prisma.sale.findFirst({
          where: {
            organizationId: organization.id,
          },
          orderBy: {
            saleNumber: "desc",
          },
        });

        const saleNumber = lastSale?.saleNumber ? lastSale.saleNumber + 1 : 1;

        const sale = await prisma.sale.create({
          data: {
            organizationId: organization.id,
            customerId: customer.id,
            subtotal,
            total,
            saleNumber,
            status: SaleStatus.CONFIRMED,
            items: {
              createMany: {
                data: items.map((item) => ({
                  productId: item.externalReference,
                  productName: item.name,
                  quantity: item.quantity,
                  unitPrice: item.value,
                  total: item.quantity * item.value,
                })),
              },
            },
          },
        });

        // Envia o pedido à cozinha quando o catálogo está no modo KITCHEN.
        // Falha aqui não deve derrubar o webhook (a venda já foi criada).
        try {
          await createKitchenOrdersFromSale(sale.id);
        } catch (kitchenError) {
          console.error(
            "Erro ao enviar pedido à cozinha (Asaas):",
            kitchenError,
          );
        }

        break;
      }
      default:
        console.warn("⚠️ Evento não tratado:", body.event);
    }

    // IMPORTANTE: sempre responder 200
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erro ao processar webhook Asaas:", error);

    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
