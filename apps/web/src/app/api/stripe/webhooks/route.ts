import type { Stripe } from "stripe";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/db";
import { createKitchenOrdersFromSale } from "@/lib/pedidos/create-orders-from-sale";
import type { ExpandedLineItem } from "@/context/checkout/types";
import { SaleStatus } from "@/generated/prisma/enums";

export async function POST(req: Request) {
  console.log("Chegou aqui!!!");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      await (await req.blob()).text(),
      req.headers.get("stripe-signature") as string,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (error! instanceof Error) {
      console.log(error);
    }

    console.log(`❌ Stripe webhook error: ${errorMessage}`);
    return NextResponse.json(
      { message: `Webhook error: ${errorMessage}` },
      { status: 400 },
    );
  }

  console.log("✅ Sucess:", event.id);

  const permittedEvents: string[] = ["checkout.session.completed"];

  if (permittedEvents.includes(event.type)) {
    let data;

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          data = event.data.object as Stripe.Checkout.Session;

          if (!data.metadata?.customerId) {
            throw new Error("User ID is required in metadata");
          }

          const customer = await prisma.customer.findFirst({
            where: {
              userCatalog: {
                id: data.metadata.customerId,
              },
            },
          });

          if (!customer) {
            throw new Error("User not found");
          }

          if (!data.metadata?.organizationId) {
            throw new Error("Organization ID is required in metadata");
          }

          const organization = await prisma.organization.findUnique({
            where: {
              id: data.metadata.organizationId,
            },
          });

          if (!organization) {
            throw new Error("Organization not found");
          }

          const expandedSession = await stripe.checkout.sessions.retrieve(
            data.id,
            {
              expand: ["line_items.data.price.product"],
            },
          );

          if (
            !expandedSession.line_items?.data ||
            !expandedSession.line_items.data.length
          ) {
            throw new Error("Line items not found");
          }

          const lineItems = expandedSession.line_items
            .data as ExpandedLineItem[];

          const subtotal = lineItems.reduce((acc, item) => {
            return acc + item.price.unit_amount! * item.quantity!;
          }, 0);

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
                  data: lineItems.map((item) => ({
                    productId: item.price.product.metadata.id,
                    productName: item.price.product.name,
                    quantity: item.quantity!,
                    unitPrice: item.price.unit_amount!,
                    total: item.price.unit_amount! * item.quantity!,
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
              "Erro ao enviar pedido à cozinha (Stripe):",
              kitchenError,
            );
          }

          break;
        }
        default:
          throw new Error(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.log(error);
      return NextResponse.json(
        { message: `Webhook handler failed: ${error}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: "Received" }, { status: 200 });
}
