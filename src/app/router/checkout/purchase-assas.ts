import { base } from "@/app/middlewares/base";
import prisma from "@/lib/db";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { constructUrl, getCustomDomain } from "@/lib/utils";
import { z } from "zod";

type ProductItem = {
  externalReference?: string;
  description?: string;
  imageBase64?: string;
  name: string;
  quantity: number;
  value: number;
};

type AssasOptions = {
  billingTypes: string[];
  chargeTypes: string[];
  minutesToExpire?: number;
  externalReference: string;
  callback: {
    successUrl: string;
    cancelUrl: string;
    expiredUrl?: string;
  };
  items: ProductItem[];
  installment: {
    maxInstallmentCount: number;
  };
  customerData: {
    name: string;
    cpfCnpj: string;
    email: string;
    phoneNumber: string;
    address: string;
    addressNumber: string;
    postalCode: string;
    province: string;
  };
};

export const purchaseAssas = base
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
    const url = process.env.ASSAS_API_URL || "https://api-sandbox.asaas.com/v3";

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

    const customer = await prisma.catalogUser.findUnique({
      where: {
        id: input.customerId,
      },
      include: {
        customer: true,
      },
    });

    if (!customer) {
      throw errors.NOT_FOUND({
        message: "Cliente não encontrado!",
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

    const baseUrl = getCustomDomain(input.domain);

    // Preço resolvido server-side pela tabela do CatalogUser.
    const resolved = await resolveManyPrices({
      organizationId: organization.id,
      priceListId: customer.priceListId ?? null,
      items: input.products.map((p) => ({ productId: p.id, quantity: p.quantity })),
    });

    const productItems: ProductItem[] = input.products.map((inputProduct, i) => {
      const product = products.find((p) => p.id === inputProduct.id)!;
      const resolvedUnitPrice = resolved[i].unitPrice;

      let image = "";

      if (product.thumbnail) {
        const imageUrl = constructUrl(product.thumbnail);

        // Valida se a URL foi construída corretamente
        try {
          new URL(imageUrl); // Lança erro se URL for inválida
          image = imageUrl;

          console.log(image);
        } catch (error) {
          console.error(
            `Invalid image URL for product ${product.id}:`,
            imageUrl,
          );
        }
      }

      return {
        externalReference: product.id,
        description: product.description || "",
        name: product.name.slice(0, 20),
        quantity: inputProduct.quantity,
        value: resolvedUnitPrice,
      };
    });

    const body = {
      billingTypes: ["CREDIT_CARD", "PIX"],
      chargeTypes: ["INSTALLMENT", "DETACHED"],
      minutesToExpire: 30, // Tempo em minutos
      externalReference: `${customer.customer?.id}-${organization.id}`,
      callback: {
        successUrl: `${baseUrl}/checkout?success=true`,
        cancelUrl: `${baseUrl}/checkout?cancel=true`,
        expiredUrl: `${baseUrl}/checkout?expired=true`,
      },
      items: productItems,
      installment: {
        maxInstallmentCount: 12,
      },
    } as AssasOptions;

    const ACCESS_TOKEN = `$${process.env.ASSAS_ACCESS_TOKEN as string}` || "";
    console.log("Access Token:", ACCESS_TOKEN);

    const response = await fetch(`${url}/checkouts`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        access_token: ACCESS_TOKEN,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Assas API error:", errorData);
      throw errors.BAD_REQUEST({
        message: "Erro ao criar checkout Assas!",
      });
    }

    const data = await response.json();

    if (!data.link) {
      throw errors.BAD_REQUEST({
        message: "Erro ao criar checkout Assas! Link não encontrado.",
      });
    }

    return {
      url: data.link,
    };
  });
