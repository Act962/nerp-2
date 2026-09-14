import { base } from "@/app/middlewares/base";
import { CatalogLayout, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { createKitchenOrdersFromSale } from "@/lib/pedidos/create-orders-from-sale";
import { resolveGuestCustomer } from "@/lib/pedidos/resolve-guest-customer";
import {
  nextSaleNumber,
  resolveSaleItems,
} from "@/lib/pedidos/resolve-sale-items";
import { resolverGateway } from "@/features/pagamentos/server/resolver-gateway";
import prismaClient from "@/lib/db";
import { z } from "zod";

/**
 * Checkout do cardápio — o pedido que vem do link do Instagram ou do QR da mesa.
 *
 * Sem cadastro: nome e WhatsApp bastam. A venda nasce `PENDING_APPROVAL` e os
 * pedidos nascem SEM `acceptedAt`, ou seja, fora do board, na barra "Novos
 * pedidos", esperando o dono aceitar. Enquanto não houver pagamento online
 * (Fase 2), aceitar é o que impede um trote de virar cupom impresso e comida
 * na chapa.
 *
 * Não estende `approvalCheckout` nem `kitchenCheckout` de propósito: aprovar no
 * primeiro significa hidratar o carrinho do PDV e CANCELAR a venda, que é fluxo
 * de balcão; o segundo exige conta de cliente no catálogo, deriva `saleNumber`
 * por `findFirst + 1` e ignora tabela de preço.
 *
 * Multi-tenant: a organização sai sempre do `subdomain` público, e nenhum id
 * vindo do cliente é usado sem revalidar contra ela.
 */
export const menuCheckout = base
  .input(
    z.object({
      products: z
        .array(
          z.object({
            id: z.string(),
            quantity: z.number().int().positive(),
            notes: z.string().max(200).optional(),
          }),
        )
        .min(1),
      domain: z.string().min(1),
      customer: z.object({
        name: z.string().trim().min(1, "Informe seu nome").max(120),
        phone: z.string().trim().max(30).optional(),
      }),
      notes: z.string().max(500).optional(),
    }),
  )
  .output(
    z.object({
      saleId: z.string(),
      saleNumber: z.number(),
      ticketId: z.string().nullable(),
      /**
       * Quando a loja tem gateway instalado, o pedido só vai para a cozinha
       * depois que o PIX confirmar. `null` = loja sem cobrança: o pedido fica
       * esperando o aceite de alguém da equipe, como na Fase 1.
       */
      cobranca: z
        .object({
          id: z.string(),
          pixPayload: z.string().nullable(),
          pixQrImage: z.string().nullable(),
          urlDePagamento: z.string().nullable(),
          valor: z.number(),
        })
        .nullable(),
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
      select: { layout: true, allowOrders: true },
    });

    if (settings?.layout !== CatalogLayout.CARDAPIO || !settings.allowOrders) {
      throw errors.BAD_REQUEST({
        message:
          "Esta loja não está aceitando pedidos pelo cardápio no momento.",
      });
    }

    const customerId = await resolveGuestCustomer({
      organizationId: organization.id,
      guest: input.customer,
      origem: "Cliente criado pelo cardápio online.",
    });

    const resolved = await resolveSaleItems({
      organizationId: organization.id,
      customerId,
      products: input.products,
    });

    if (!resolved.ok) {
      throw errors.NOT_FOUND({
        message: "Alguns itens saíram do cardápio. Confira sua sacola.",
      });
    }

    const saleNumber = await nextSaleNumber(organization.id);

    const sale = await prisma.sale.create({
      data: {
        organizationId: organization.id,
        customerId,
        priceListId: resolved.priceListId,
        subtotal: resolved.subtotal,
        total: resolved.subtotal,
        saleNumber,
        status: SaleStatus.PENDING_APPROVAL,
        notes: input.notes?.trim() || null,
        items: { createMany: { data: resolved.items } },
      },
      select: { id: true, saleNumber: true },
    });

    // O ticket nasce SEMPRE aguardando: é o pagamento (ou o aceite de alguém
    // da equipe) que o solta para a cozinha. A venda já existe; se a cozinha
    // falhar, o pedido aparece na fila do PDV e ninguém perde dinheiro — por
    // isso não derruba a resposta.
    let ticketId: string | null = null;
    try {
      ticketId =
        (await createKitchenOrdersFromSale(sale.id, {
          requiresAcceptance: true,
        })) ?? null;
    } catch (error) {
      console.error(
        `[menu-checkout] venda ${sale.saleNumber} criada, mas a cozinha falhou:`,
        error,
      );
    }

    const cobranca = await abrirCobranca({
      organizationId: organization.id,
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      valor: resolved.subtotal,
      cliente: { nome: input.customer.name, telefone: input.customer.phone },
    });

    return {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      ticketId,
      cobranca,
    };
  });

/**
 * Abre a cobrança PIX, quando a loja tem gateway instalado.
 *
 * Falhar aqui NÃO derruba o pedido: a venda já está gravada e o ticket já
 * espera na fila. Sem cobrança, o caminho é o da Fase 1 — alguém da equipe
 * aceita. Perder o pedido porque o provedor piscou seria o pior desfecho.
 */
async function abrirCobranca({
  organizationId,
  saleId,
  saleNumber,
  valor,
  cliente,
}: {
  organizationId: string;
  saleId: string;
  saleNumber: number;
  valor: number;
  cliente: { nome: string; telefone?: string };
}) {
  const gateway = await resolverGateway(organizationId);
  if (!gateway) return null;

  try {
    const criada = await gateway.provedor.criarCobranca({
      valor,
      metodo: "PIX",
      descricao: `Pedido #${saleNumber}`,
      referencia: saleId,
      pagador: {
        nome: cliente.nome,
        // O Asaas exige e-mail. Sem cadastro, o telefone é o que identifica o
        // cliente — o endereço é sintético e só serve para não criar um
        // cadastro novo a cada pedido da mesma pessoa.
        email: `${(cliente.telefone ?? saleId).replace(/\D/g, "") || saleId}@pedido.local`,
      },
    });

    const registro = await prismaClient.charge.create({
      data: {
        organizationId,
        saleId,
        integrationId: gateway.integrationId,
        provider: gateway.provedor.nome,
        externalId: criada.externalId,
        method: "PIX",
        amount: valor,
        pixPayload: criada.pixPayload ?? null,
        pixQrImage: criada.pixQrImage ?? null,
        expiresAt: criada.expiraEm ?? null,
      },
      select: { id: true },
    });

    return {
      id: registro.id,
      pixPayload: criada.pixPayload ?? null,
      pixQrImage: criada.pixQrImage ?? null,
      urlDePagamento: criada.urlDePagamento ?? null,
      valor,
    };
  } catch (erro) {
    console.error(
      `[menu-checkout] venda ${saleNumber} criada, mas a cobrança falhou:`,
      erro instanceof Error ? erro.message : erro,
    );
    return null;
  }
}
