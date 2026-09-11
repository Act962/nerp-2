import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { whereVendaValida } from "@/features/sales/lib/venda-valida";
import prisma from "@/lib/db";
import { type ContextoToolsApp, dinheiro, numero } from "./_contexto";

/**
 * Estoque: o que está acabando, o que não sai e para quantos dias dá.
 *
 * "Baixo" é a mesma regra dos widgets do dashboard — `currentStock <=
 * minStock`, entre produtos ativos que controlam estoque. Duas definições de
 * "estoque baixo" no mesmo sistema seriam dois números para a mesma pergunta.
 */
export function construirToolsDeEstoque(ctx: ContextoToolsApp): ToolSet {
  const { organizationId } = ctx;

  return {
    estoqueBaixo: tool({
      description:
        "Produtos com estoque igual ou abaixo do mínimo configurado, do mais crítico para o menos.",
      inputSchema: z.object({
        limite: z.number().int().min(1).max(30).default(15),
      }),
      execute: async ({ limite }) => {
        const produtos = await prisma.product.findMany({
          where: {
            organizationId,
            isActive: true,
            trackStock: true,
            currentStock: { lte: prisma.product.fields.minStock },
          },
          orderBy: { currentStock: "asc" },
          take: limite,
          select: {
            name: true,
            sku: true,
            currentStock: true,
            minStock: true,
            unit: true,
            supplier: { select: { name: true } },
          },
        });

        return {
          criterio:
            "estoque atual menor ou igual ao mínimo, produto ativo com controle de estoque",
          produtos: produtos.map((produto) => ({
            nome: produto.name,
            sku: produto.sku,
            estoque: numero(produto.currentStock),
            minimo: numero(produto.minStock),
            unidade: produto.unit,
            fornecedor: produto.supplier?.name ?? null,
          })),
        };
      },
    }),

    estoqueParado: tool({
      description:
        "Produtos com estoque que não vendem há N dias — dinheiro parado na prateleira.",
      inputSchema: z.object({
        diasSemVender: z.number().int().min(7).max(365).default(60),
        limite: z.number().int().min(1).max(30).default(15),
      }),
      execute: async ({ diasSemVender, limite }) => {
        const corte = new Date(Date.now() - diasSemVender * 86_400_000);

        const vendidos = await prisma.saleItem.findMany({
          where: {
            sale: {
              ...whereVendaValida(organizationId),
              createdAt: { gte: corte },
            },
          },
          select: { productId: true },
          distinct: ["productId"],
        });

        const produtos = await prisma.product.findMany({
          where: {
            organizationId,
            isActive: true,
            trackStock: true,
            currentStock: { gt: 0 },
            id: { notIn: vendidos.map((v) => v.productId) },
          },
          orderBy: { currentStock: "desc" },
          take: limite,
          select: {
            name: true,
            sku: true,
            currentStock: true,
            costPrice: true,
            salePrice: true,
            unit: true,
          },
        });

        return {
          criterio: `com estoque e sem nenhuma venda nos últimos ${diasSemVender} dias`,
          produtos: produtos.map((produto) => ({
            nome: produto.name,
            sku: produto.sku,
            estoque: numero(produto.currentStock),
            unidade: produto.unit,
            valorParado: Number(
              (
                numero(produto.currentStock) * numero(produto.costPrice)
              ).toFixed(2),
            ),
            preco: dinheiro(produto.salePrice),
          })),
        };
      },
    }),

    coberturaDeEstoque: tool({
      description:
        "Para quantos dias o estoque atual dá, pela média de saída dos últimos 30 dias. Sem termo, devolve os produtos com a menor cobertura.",
      inputSchema: z.object({
        termo: z.string().max(80).optional(),
        limite: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ termo, limite }) => {
        const desde = new Date(Date.now() - 30 * 86_400_000);

        const produtos = await prisma.product.findMany({
          where: {
            organizationId,
            isActive: true,
            trackStock: true,
            ...(termo
              ? {
                  OR: [
                    { name: { contains: termo, mode: "insensitive" } },
                    { sku: { contains: termo, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            sku: true,
            currentStock: true,
            unit: true,
          },
          take: termo ? limite : 200,
        });
        if (produtos.length === 0) return { produtos: [] };

        const saidas = await prisma.saleItem.groupBy({
          by: ["productId"],
          where: {
            productId: { in: produtos.map((p) => p.id) },
            sale: {
              ...whereVendaValida(organizationId),
              createdAt: { gte: desde },
            },
          },
          _sum: { quantity: true },
        });
        const porProduto = new Map(
          saidas.map((s) => [s.productId, numero(s._sum.quantity) / 30]),
        );

        const calculados = produtos.map((produto) => {
          const mediaDiaria = porProduto.get(produto.id) ?? 0;
          const estoque = numero(produto.currentStock);
          return {
            nome: produto.name,
            sku: produto.sku,
            estoque,
            unidade: produto.unit,
            saidaMediaDiaria: Number(mediaDiaria.toFixed(2)),
            diasDeCobertura:
              mediaDiaria > 0 ? Math.floor(estoque / mediaDiaria) : null,
          };
        });

        return {
          metodo:
            "cobertura = estoque atual dividido pela média diária de saída dos últimos 30 dias; sem saída no período, a cobertura fica indefinida",
          produtos: termo
            ? calculados
            : calculados
                .filter((p) => p.diasDeCobertura !== null)
                .sort(
                  (a, b) => (a.diasDeCobertura ?? 0) - (b.diasDeCobertura ?? 0),
                )
                .slice(0, limite),
        };
      },
    }),
  };
}
