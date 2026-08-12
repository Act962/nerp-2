import { base } from "@/app/middlewares/base";
import type {
  CheckoutMetadata,
  ProductMetadata,
} from "@/context/checkout/types";
import { useConstructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/db";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { stripe } from "@/lib/stripe";
import { constructUrl, getCustomDomain } from "@/lib/utils";
import type Stripe from "stripe";
import { z } from "zod";

export const purchase = base
  .input(
    z.object({
      products: z
        .array(
          z.object({
            id: z.string(),
            quantity: z.number().int().positive(),
          }),
        )
        .min(1),
      domain: z.string().min(1),
      email: z.email(),
      customerId: z.string().min(1),
    }),
  )
  .output(
    z.object({
      url: z.string().min(1),
    }),
  )
  .handler(async ({ input, errors }) => {
    const organization = await prisma.organization.findUnique({
      where: {
        subdomain: input.domain,
      },
    });

    if (!organization) {
      throw errors.NOT_FOUND({
        message: "Oganização não encontrada!",
      });
    }

    const productIds = input.products.map((p) => p.id);
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds,
        },
        currentStock: {
          gte: 1,
        },
        organizationId: organization.id,
      },
    });

    if (products.length !== input.products.length) {
      throw errors.NOT_FOUND({
        message: "Alguns produtos não foram encontrados ou estão sem estoque!",
      });
    }

    // Resolve preço server-side via tabela do CatalogUser (guest cai na default).
    const catalogUser = await prisma.catalogUser.findFirst({
      where: { id: input.customerId, organizationId: organization.id },
      select: { priceListId: true },
    });
    const resolved = await resolveManyPrices({
      organizationId: organization.id,
      priceListId: catalogUser?.priceListId ?? null,
      items: input.products.map((p) => ({ productId: p.id, quantity: p.quantity })),
    });

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      input.products.map((inputProduct, i) => {
        const product = products.find((p) => p.id === inputProduct.id)!;
        const resolvedUnitPrice = resolved[i].unitPrice;

        let images: string[] = [];

        if (product.thumbnail) {
          const imageUrl = constructUrl(product.thumbnail);

          // Valida se a URL foi construída corretamente
          try {
            new URL(imageUrl); // Lança erro se URL for inválida
            images = [imageUrl];

            console.log(images);
          } catch (error) {
            console.error(
              `Invalid image URL for product ${product.id}:`,
              imageUrl,
            );
          }
        }

        return {
          quantity: inputProduct.quantity,
          price_data: {
            unit_amount: Math.round(resolvedUnitPrice * 100),
            currency: "brl",
            product_data: {
              name: product.name,
              images,
              metadata: {
                id: product.id,
                name: product.name,
                price: resolvedUnitPrice,
                organizationId: organization.id,
                organizationName: organization.name,
              } as ProductMetadata,
            },
          },
        };
      });

    const url = getCustomDomain(input.domain);

    console.log(url);

    const checkout = await stripe.checkout.sessions.create({
      customer_email: input.email,
      success_url: `${url}/checkout?success=true`,
      cancel_url: `${url}/checkout?cancel=true`,
      mode: "payment",
      line_items: lineItems,
      invoice_creation: {
        enabled: true,
      },
      metadata: {
        customerId: input.customerId,
        organizationId: organization.id,
      } as CheckoutMetadata,
    });

    if (!checkout.url) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Erro ao criar sessão de checkout!",
      });
    }

    return { url: checkout.url };
  });
