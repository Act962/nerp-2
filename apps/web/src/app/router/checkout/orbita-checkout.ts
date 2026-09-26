import { base } from "@/app/middlewares/base";
import { CatalogOperationMode, SaleOrigin } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { createPendingSale } from "@/features/storefront/server/create-pending-sale";
import { enqueueOrbitaOrder } from "@/features/orbita-orders/server/enqueue";
import { findOrbitaPushKey } from "@/features/orbita-orders/server/find-push-key";
import { z } from "zod";
import { toCheckoutError } from "./pending-sale-errors";

/**
 * Checkout do modo ORBITA.
 *
 * Mesmo pedido do modo APPROVAL — `Sale` em `PENDING_APPROVAL`, sem cobrança
 * nem baixa de estoque —, mas em vez de esperar o balcão ele é empurrado ao
 * Órbita, onde o Astro negocia, cobra via PIX e confirma a venda de volta por
 * `catalogOrder.updateStatus`. O telefone é obrigatório: é por ele que o
 * Órbita fala com o cliente.
 *
 * Multi-tenant: `organizationId` sempre resolvido a partir do `subdomain`
 * público.
 */
export const orbitaCheckout = base
  .input(
    z
      .object({
        products: z
          .array(
            z.object({
              id: z.string(),
              quantity: z.number().int().positive(),
            }),
          )
          .min(1),
        domain: z.string().min(1),
        customerId: z.string().min(1).optional(),
        guest: z
          .object({
            name: z.string().min(1).max(120),
            phone: z.string().max(30).optional(),
          })
          .optional(),
        phone: z
          .string()
          .max(30)
          .refine((value) => value.replace(/\D/g, "").length >= 10, {
            message: "Informe um telefone com DDD",
          }),
        delivery: z
          .object({
            method: z.string().max(60).nullable(),
            address: z.string().max(500).nullable(),
          })
          .optional(),
        notes: z.string().max(1000).optional(),
      })
      .refine((value) => Boolean(value.customerId) || Boolean(value.guest), {
        message: "Informe customerId ou guest.name",
      }),
  )
  .output(
    z.object({
      saleId: z.string(),
      saleNumber: z.number(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const organization = await prisma.organization.findUnique({
      where: { subdomain: input.domain },
      select: { id: true },
    });

    if (!organization) {
      throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
    }

    const settings = await prisma.catalogSettings.findUnique({
      where: { organizationId: organization.id },
      select: { operationMode: true, allowOrders: true },
    });

    if (
      settings?.operationMode !== CatalogOperationMode.ORBITA ||
      !settings.allowOrders
    ) {
      throw errors.BAD_REQUEST({
        message: "A loja não está recebendo pedidos pelo Órbita no momento.",
      });
    }

    // Sem chave com o escopo de envio, o pedido nasceria sem ter para onde ir.
    const pushKey = await findOrbitaPushKey(organization.id);
    if (!pushKey) {
      throw errors.BAD_REQUEST({
        message:
          "A loja ainda não conectou o Órbita para receber pedidos. Tente mais tarde.",
      });
    }

    const phone = input.phone.trim();
    const notes = input.notes?.trim() || undefined;

    let created: { saleId: string; saleNumber: number };
    try {
      created = await createPendingSale({
        organizationId: organization.id,
        origin: SaleOrigin.CATALOGO_ORBITA,
        products: input.products,
        customerId: input.customerId,
        guest: input.guest ? { name: input.guest.name, phone } : undefined,
        contactPhone: phone,
        notes,
        defaultSaleNote: "Pedido do Catálogo Online (enviado ao Órbita)",
        newCustomerNote: "Cliente criado via Catálogo Online (modo Órbita).",
      });
    } catch (error) {
      throw toCheckoutError(error, errors);
    }

    // Falha ao agendar não desfaz o pedido: ele já existe e aparece na fila
    // de pendentes do PDV, onde a loja pode atendê-lo à mão.
    try {
      await enqueueOrbitaOrder(created.saleId, {
        method: input.delivery?.method ?? null,
        address: input.delivery?.address ?? null,
        notes: notes ?? null,
      });
    } catch (error) {
      console.error(
        `[checkout.orbitaCheckout] falha ao agendar a venda ${created.saleId}:`,
        error,
      );
    }

    return created;
  });
