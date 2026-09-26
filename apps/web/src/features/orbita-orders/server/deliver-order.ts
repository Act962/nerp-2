import "server-only";
import { NonRetriableError } from "inngest";
import { z } from "zod";
import prisma from "@/lib/db";
import { decryptSecret } from "@/lib/nasa-s2s-crypto";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  emptyToNull,
  onlyDigits,
  type OrbitaOrderDelivery,
  type OrbitaOrderPayload,
  type OrbitaOrderResponse,
} from "../lib/payload";
import { buildOrbitaOrderHeaders, ORBITA_ORDERS_PATH } from "../lib/sign";
import { findOrbitaPushKey } from "./find-push-key";

const TIMEOUT_MS = 15_000;

const orbitaOrderResponseSchema = z.object({
  orderToken: z.string().min(1),
  portalUrl: z.string().min(1),
  whatsappUrl: z.string().nullable().optional(),
});

export type DeliverOrbitaOrderResult =
  | { status: "already-synced" }
  | { status: "delivered"; orderToken: string };

function resolveOrbitaBaseUrl(): string {
  const baseUrl = process.env.NASA_SYNC_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing env NASA_SYNC_BASE_URL");
  }
  return baseUrl.replace(/\/$/, "");
}

function buildCatalogUrl(subdomain: string | null): string | null {
  if (!subdomain) return null;
  const baseOrigin = (
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${baseOrigin}/catalogo/${subdomain}`;
}

async function buildOrbitaOrderPayload(
  saleId: string,
  delivery: OrbitaOrderDelivery,
): Promise<{ organizationId: string; payload: OrbitaOrderPayload } | null> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: {
        select: { name: true, phone: true, email: true, document: true },
      },
      organization: { select: { subdomain: true } },
      items: true,
    },
  });
  if (!sale) return null;

  const productIds = sale.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId: sale.organizationId },
    select: { id: true, sku: true, thumbnail: true, images: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  const items = sale.items.map((item) => {
    const product = productById.get(item.productId);
    const imageKey = product?.thumbnail || product?.images[0] || "";
    return {
      productId: item.productId,
      name: item.productName,
      sku: product?.sku ?? null,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
      imageUrl: emptyToNull(constructUrl(imageKey)),
    };
  });

  return {
    organizationId: sale.organizationId,
    payload: {
      nerpSaleId: sale.id,
      saleNumber: sale.saleNumber,
      createdAt: sale.createdAt.toISOString(),
      customer: {
        name: sale.customer?.name ?? "Cliente do catálogo",
        phone: onlyDigits(sale.customer?.phone),
        email: emptyToNull(sale.customer?.email),
        document: emptyToNull(sale.customer?.document),
      },
      delivery: {
        method: emptyToNull(delivery.method),
        address: emptyToNull(delivery.address),
        notes: emptyToNull(delivery.notes),
      },
      items,
      subtotal: Number(sale.subtotal),
      shipping: Number(sale.shipping),
      discount: Number(sale.discount),
      total: Number(sale.total),
      catalogUrl: buildCatalogUrl(sale.organization.subdomain),
    },
  };
}

async function postOrbitaOrder(input: {
  organizationId: string;
  payload: OrbitaOrderPayload;
}): Promise<OrbitaOrderResponse> {
  const key = await findOrbitaPushKey(input.organizationId);
  if (!key) {
    throw new NonRetriableError(
      "Organização sem integração ativa com o Órbita (escopo catalog-orders:push).",
    );
  }

  const secret = decryptSecret(key.secretCiphertext);
  const body = JSON.stringify(input.payload);
  const headers = buildOrbitaOrderHeaders({
    apiKey: key.apiKey,
    organizationId: input.organizationId,
    secret,
    body,
    timestamp: Date.now().toString(),
  });

  const response = await fetch(
    `${resolveOrbitaBaseUrl()}${ORBITA_ORDERS_PATH}`,
    {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  const responseText = await response.text().catch(() => "");

  if (response.status === 409 && isIntegrationInactive(responseText)) {
    throw new NonRetriableError(
      "O Órbita recusou o pedido: integração do catálogo inativa.",
    );
  }
  if (!response.ok) {
    throw new Error(
      `pedido→órbita falhou: HTTP ${response.status} ${responseText.slice(0, 300)}`,
    );
  }

  const parsed = orbitaOrderResponseSchema.safeParse(
    parseJsonOrNull(responseText),
  );
  if (!parsed.success) {
    throw new Error("pedido→órbita: resposta fora do contrato");
  }
  return {
    orderToken: parsed.data.orderToken,
    portalUrl: parsed.data.portalUrl,
    whatsappUrl: parsed.data.whatsappUrl ?? null,
  };
}

function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isIntegrationInactive(responseText: string): boolean {
  const responseBody = parseJsonOrNull(responseText);
  return (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "error" in responseBody &&
    responseBody.error === "catalog_integration_inactive"
  );
}

/**
 * Entrega um pedido ao Órbita e guarda na `Sale` o que ele devolveu.
 * Idempotente: venda já sincronizada não é reenviada.
 */
export async function deliverOrbitaOrder(
  saleId: string,
  delivery: OrbitaOrderDelivery,
): Promise<DeliverOrbitaOrderResult> {
  const current = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { orbitaSyncedAt: true },
  });
  if (!current) {
    throw new NonRetriableError(`Venda ${saleId} não encontrada.`);
  }
  if (current.orbitaSyncedAt) return { status: "already-synced" };

  const built = await buildOrbitaOrderPayload(saleId, delivery);
  if (!built) {
    throw new NonRetriableError(`Venda ${saleId} não encontrada.`);
  }

  const orbitaResponse = await postOrbitaOrder(built);

  await prisma.sale.update({
    where: { id: saleId },
    data: {
      orbitaOrderToken: orbitaResponse.orderToken,
      orbitaPortalUrl: orbitaResponse.portalUrl,
      orbitaWhatsappUrl: orbitaResponse.whatsappUrl,
      orbitaSyncedAt: new Date(),
    },
  });

  return { status: "delivered", orderToken: orbitaResponse.orderToken };
}
