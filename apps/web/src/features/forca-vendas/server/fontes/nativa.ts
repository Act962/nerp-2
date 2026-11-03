import "server-only";

import { STATUS_VENDA_VALIDA } from "@/features/sales/lib/venda-valida";
import prisma from "@/lib/db";
import {
  type CompraDoCliente,
  type CompraDoProduto,
  type EstoqueDoProduto,
  type FonteComercial,
  RESUMO_VAZIO,
  type ResumoFinanceiroCliente,
  type TituloDoCliente,
} from "./porta";

// Status de título que ainda é dinheiro a receber. PENDING_APPROVAL é
// lançamento que nem foi aprovado no financeiro — não conta como dívida.
const EM_ABERTO = ["PENDING", "PARTIAL", "OVERDUE"] as const;

function inicioDoDia(): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje;
}

/**
 * Os dados comerciais lidos do próprio NERP: títulos do Financeiro ligados às
 * vendas do cliente, as vendas que contam (`STATUS_VENDA_VALIDA`, a mesma régua
 * do dashboard e do Astro) e o estoque do cadastro de produtos.
 */
export function criarFonteNativa(organizationId: string): FonteComercial {
  async function titulos(customerIds: string[]) {
    if (customerIds.length === 0) return [];
    return prisma.paymentEntry.findMany({
      where: {
        organizationId,
        type: "RECEIVABLE",
        status: { in: [...EM_ABERTO] },
        sale: { customerId: { in: customerIds } },
      },
      select: {
        id: true,
        description: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        sale: { select: { customerId: true, saleNumber: true } },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  return {
    origem: "NATIVO",

    async resumoFinanceiro(customerIds) {
      const hoje = inicioDoDia();
      const resumo = new Map<string, ResumoFinanceiroCliente>();
      for (const titulo of await titulos(customerIds)) {
        const customerId = titulo.sale?.customerId;
        if (!customerId) continue;
        const atual = resumo.get(customerId) ?? { ...RESUMO_VAZIO };
        const saldo = (titulo.amount - titulo.paidAmount) / 100;
        atual.emAberto += saldo;
        if (titulo.dueDate < hoje) {
          atual.vencido += saldo;
          atual.titulosVencidos += 1;
          if (!atual.vencimentoMaisAntigo) {
            atual.vencimentoMaisAntigo = titulo.dueDate.toISOString();
          }
        }
        resumo.set(customerId, atual);
      }
      return resumo;
    },

    async titulosEmAberto(customerIds) {
      const hoje = inicioDoDia();
      return (await titulos(customerIds)).flatMap(
        (titulo): TituloDoCliente[] => {
          const customerId = titulo.sale?.customerId;
          if (!customerId) return [];
          return [
            {
              id: titulo.id,
              customerId,
              descricao: titulo.description,
              valor: titulo.amount / 100,
              valorPago: titulo.paidAmount / 100,
              vencimento: titulo.dueDate.toISOString(),
              vencido: titulo.dueDate < hoje,
              numeroDaVenda: titulo.sale?.saleNumber ?? null,
            },
          ];
        },
      );
    },

    async ultimasCompras(customerId, limite) {
      const vendas = await prisma.sale.findMany({
        where: {
          organizationId,
          customerId,
          status: { in: [...STATUS_VENDA_VALIDA] },
        },
        orderBy: { createdAt: "desc" },
        take: limite,
        select: {
          id: true,
          saleNumber: true,
          createdAt: true,
          completedAt: true,
          total: true,
          _count: { select: { items: true } },
        },
      });
      return vendas.map(
        (venda): CompraDoCliente => ({
          saleId: venda.id,
          numero: venda.saleNumber,
          data: (venda.completedAt ?? venda.createdAt).toISOString(),
          total: Number(venda.total),
          itens: venda._count.items,
        }),
      );
    },

    async comprasDoProduto(customerId, productId, limite) {
      const itens = await prisma.saleItem.findMany({
        where: {
          productId,
          sale: {
            organizationId,
            customerId,
            status: { in: [...STATUS_VENDA_VALIDA] },
          },
        },
        orderBy: { sale: { createdAt: "desc" } },
        take: limite,
        select: {
          quantity: true,
          unitPrice: true,
          sale: {
            select: { saleNumber: true, createdAt: true, completedAt: true },
          },
        },
      });
      return itens.map(
        (item): CompraDoProduto => ({
          numero: item.sale.saleNumber,
          data: (item.sale.completedAt ?? item.sale.createdAt).toISOString(),
          quantidade: Number(item.quantity),
          precoUnitario: Number(item.unitPrice),
        }),
      );
    },

    async ultimaCompraPorCliente(customerIds) {
      if (customerIds.length === 0) return new Map();
      const linhas = await prisma.sale.groupBy({
        by: ["customerId"],
        where: {
          organizationId,
          customerId: { in: customerIds },
          status: { in: [...STATUS_VENDA_VALIDA] },
        },
        _max: { createdAt: true },
      });
      const mapa = new Map<string, string>();
      for (const linha of linhas) {
        if (linha.customerId && linha._max.createdAt) {
          mapa.set(linha.customerId, linha._max.createdAt.toISOString());
        }
      }
      return mapa;
    },

    async estoque(productIds) {
      if (productIds.length === 0) return new Map();
      const [produtos, comprometidos] = await Promise.all([
        prisma.product.findMany({
          where: { id: { in: productIds }, organizationId },
          select: {
            id: true,
            currentStock: true,
            trackStock: true,
            branchStocks: {
              select: { branchCode: true, branchName: true, stock: true },
              orderBy: { branchCode: "asc" },
            },
          },
        }),
        // A baixa só acontece no faturamento; até lá o pedido aprovado (ou em
        // aprovação) segura a mercadoria. Orçamento nasce DRAFT e fica de fora.
        prisma.saleItem.groupBy({
          by: ["productId"],
          where: {
            productId: { in: productIds },
            sale: {
              organizationId,
              origin: "FORCA_VENDAS",
              status: { in: ["PENDING_APPROVAL", "CONFIRMED"] },
            },
          },
          _sum: { quantity: true },
        }),
      ]);
      const comprometidoPor = new Map(
        comprometidos.map((linha) => [
          linha.productId,
          Number(linha._sum.quantity ?? 0),
        ]),
      );
      const mapa = new Map<string, EstoqueDoProduto>();
      for (const produto of produtos) {
        const fisico = Number(produto.currentStock);
        const comprometido = comprometidoPor.get(produto.id) ?? 0;
        mapa.set(produto.id, {
          fisico,
          comprometido,
          disponivel: fisico - comprometido,
          controlaEstoque: produto.trackStock,
          filiais: produto.branchStocks.map((filial) => ({
            codigo: filial.branchCode,
            nome: filial.branchName,
            quantidade: Number(filial.stock),
          })),
        });
      }
      return mapa;
    },
  };
}
