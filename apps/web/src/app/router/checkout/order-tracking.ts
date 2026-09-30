import { base } from "@/app/middlewares/base";
import { SaleOrigin, SaleStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/db";
import { z } from "zod";

/**
 * O acompanhamento público de um pedido do catálogo.
 *
 * Sem login, como o resto da vitrine: quem tem o link do pedido acompanha.
 * Duas travas: a venda é buscada dentro da loja do `subdomain`, e só vale
 * venda nascida no catálogo — um id de venda de balcão (PDV) não abre nada,
 * mesmo sendo da mesma loja.
 */
export const orderTracking = base
  .input(
    z.object({
      subdomain: z.string().min(1),
      saleId: z.string().min(1),
    }),
  )
  .output(
    z.object({
      saleNumber: z.number(),
      status: z.enum(SaleStatus),
      criadoEm: z.string(),
      concluidoEm: z.string().nullable(),
      canceladoEm: z.string().nullable(),
      pagoEm: z.string().nullable(),
      subtotal: z.number(),
      frete: z.number(),
      desconto: z.number(),
      total: z.number(),
      itens: z.array(
        z.object({
          nome: z.string(),
          quantidade: z.number(),
          total: z.number(),
          thumbnail: z.string().nullable(),
        }),
      ),
      portalUrl: z.string().nullable(),
      whatsappDaLoja: z.string().nullable(),
      /** Pedido de orçamento ainda sem valor: a tela esconde os preços. */
      aguardandoValor: z.boolean(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const organization = await prisma.organization.findUnique({
      where: { subdomain: input.subdomain },
      select: {
        id: true,
        catalogSettings: {
          select: { whatsappNumber: true, showWhatsapp: true },
        },
      },
    });
    if (!organization) {
      throw errors.NOT_FOUND({ message: "Loja não encontrada." });
    }

    const venda = await prisma.sale.findFirst({
      where: {
        id: input.saleId,
        organizationId: organization.id,
        origin: { not: SaleOrigin.PDV },
      },
      select: {
        saleNumber: true,
        status: true,
        createdAt: true,
        completedAt: true,
        cancelledAt: true,
        paidAt: true,
        subtotal: true,
        shipping: true,
        discount: true,
        total: true,
        orbitaPortalUrl: true,
        quoteRequested: true,
        quotedAt: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            total: true,
            product: { select: { thumbnail: true } },
          },
        },
      },
    });
    if (!venda) {
      throw errors.NOT_FOUND({ message: "Pedido não encontrado." });
    }

    const configuracoes = organization.catalogSettings;
    return {
      saleNumber: venda.saleNumber,
      status: venda.status,
      criadoEm: venda.createdAt.toISOString(),
      concluidoEm: venda.completedAt?.toISOString() ?? null,
      canceladoEm: venda.cancelledAt?.toISOString() ?? null,
      pagoEm: venda.paidAt?.toISOString() ?? null,
      subtotal: Number(venda.subtotal),
      frete: Number(venda.shipping),
      desconto: Number(venda.discount),
      total: Number(venda.total),
      itens: venda.items.map((item) => ({
        nome: item.productName,
        quantidade: Number(item.quantity),
        total: Number(item.total),
        thumbnail: item.product.thumbnail || null,
      })),
      portalUrl: venda.orbitaPortalUrl,
      aguardandoValor: venda.quoteRequested && !venda.quotedAt,
      whatsappDaLoja:
        configuracoes?.showWhatsapp && configuracoes.whatsappNumber
          ? configuracoes.whatsappNumber
          : null,
    };
  });
