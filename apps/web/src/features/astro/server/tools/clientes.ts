import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { whereVendaValida } from "@/features/sales/lib/venda-valida";
import prisma from "@/lib/db";
import { type ContextoToolsApp, dinheiro } from "./_contexto";
import { intervaloDoPeriodo, PERIODOS, ROTULO_DO_PERIODO } from "../periodo";

/**
 * Clientes: quem compra, quem parou de comprar e o histórico de um deles.
 *
 * "Parou de comprar" não existe como coluna — é a data da última venda válida
 * por cliente, agrupada. Cliente sem venda nenhuma entra na lista como "nunca
 * comprou", que é a informação que a pessoa quer quando pergunta.
 */
export function construirToolsDeClientes(ctx: ContextoToolsApp): ToolSet {
  const { organizationId } = ctx;

  return {
    topClientes: tool({
      description:
        "Os clientes que mais compraram num período, por valor total, com quantidade de compras e ticket médio.",
      inputSchema: z.object({
        periodo: z.enum(PERIODOS).default("30d"),
        limite: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ periodo, limite }) => {
        const intervalo = intervaloDoPeriodo(periodo);
        const grupos = await prisma.sale.groupBy({
          by: ["customerId"],
          where: {
            ...whereVendaValida(organizationId, intervalo),
            customerId: { not: null },
          },
          _sum: { total: true },
          _count: { _all: true },
          orderBy: { _sum: { total: "desc" } },
          take: limite,
        });

        const ids = grupos
          .map((g) => g.customerId)
          .filter((id): id is string => id !== null);
        const clientes = await prisma.customer.findMany({
          // Redundante com o filtro da venda, e de propósito: id que veio de
          // agregação também é revalidado contra a organização.
          where: { id: { in: ids }, organizationId },
          select: { id: true, name: true, phone: true, isDemo: true },
        });
        const porId = new Map(clientes.map((c) => [c.id, c]));

        return {
          periodo: ROTULO_DO_PERIODO[periodo],
          clientes: grupos.flatMap((grupo) => {
            const cliente = grupo.customerId
              ? porId.get(grupo.customerId)
              : null;
            if (!cliente) return [];
            const total = dinheiro(grupo._sum.total);
            return [
              {
                nome: cliente.name,
                telefone: cliente.phone,
                compras: grupo._count._all,
                total,
                ticketMedio: Number((total / grupo._count._all).toFixed(2)),
                exemplo: cliente.isDemo,
              },
            ];
          }),
        };
      },
    }),

    clientesInativos: tool({
      description:
        "Clientes que não compram há mais de N dias, do mais antigo para o mais recente, com a data da última compra. Inclui quem nunca comprou.",
      inputSchema: z.object({
        diasSemComprar: z.number().int().min(7).max(365).default(60),
        limite: z.number().int().min(1).max(30).default(15),
        incluirQuemNuncaComprou: z.boolean().default(true),
      }),
      execute: async ({ diasSemComprar, limite, incluirQuemNuncaComprou }) => {
        const corte = new Date(Date.now() - diasSemComprar * 86_400_000);

        const ultimaCompra = await prisma.sale.groupBy({
          by: ["customerId"],
          where: {
            ...whereVendaValida(organizationId),
            customerId: { not: null },
          },
          _max: { createdAt: true },
          _sum: { total: true },
          _count: { _all: true },
        });

        const inativos = ultimaCompra.filter(
          (linha) => (linha._max.createdAt ?? new Date(0)) < corte,
        );
        const ids = inativos
          .map((linha) => linha.customerId)
          .filter((id): id is string => id !== null);

        const clientes = await prisma.customer.findMany({
          where: { id: { in: ids }, organizationId, isActive: true },
          select: { id: true, name: true, phone: true, isDemo: true },
        });
        const porId = new Map(clientes.map((c) => [c.id, c]));

        const lista = inativos
          .flatMap((linha) => {
            const cliente = linha.customerId
              ? porId.get(linha.customerId)
              : null;
            if (!cliente) return [];
            const total = dinheiro(linha._sum.total);
            return [
              {
                nome: cliente.name,
                telefone: cliente.phone,
                ultimaCompra:
                  linha._max.createdAt?.toISOString().slice(0, 10) ?? null,
                diasSemComprar: linha._max.createdAt
                  ? Math.floor(
                      (Date.now() - linha._max.createdAt.getTime()) /
                        86_400_000,
                    )
                  : null,
                comprasNoTotal: linha._count._all,
                jaGastou: total,
                exemplo: cliente.isDemo,
              },
            ];
          })
          .sort((a, b) => (b.diasSemComprar ?? 0) - (a.diasSemComprar ?? 0))
          .slice(0, limite);

        const nuncaCompraram = incluirQuemNuncaComprou
          ? await prisma.customer.count({
              where: { organizationId, isActive: true, sales: { none: {} } },
            })
          : 0;

        return {
          criterio: `sem comprar há mais de ${diasSemComprar} dias`,
          clientes: lista,
          nuncaCompraram,
        };
      },
    }),

    historicoDoCliente: tool({
      description:
        "O histórico de um cliente: quanto já comprou, quantas vezes, ticket médio, última compra e as compras recentes. Busca por nome, telefone ou documento.",
      inputSchema: z.object({ termo: z.string().min(2).max(80) }),
      execute: async ({ termo }) => {
        const cliente = await prisma.customer.findFirst({
          where: {
            organizationId,
            OR: [
              { name: { contains: termo, mode: "insensitive" } },
              { phone: { contains: termo } },
              { document: { contains: termo } },
              { email: { contains: termo, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            city: true,
          },
        });
        if (!cliente) {
          return { erro: `Nenhum cliente encontrado com "${termo}".` };
        }

        const [resumo, recentes] = await Promise.all([
          prisma.sale.aggregate({
            where: {
              ...whereVendaValida(organizationId),
              customerId: cliente.id,
            },
            _sum: { total: true },
            _count: { _all: true },
            _max: { createdAt: true },
          }),
          prisma.sale.findMany({
            where: {
              ...whereVendaValida(organizationId),
              customerId: cliente.id,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              createdAt: true,
              total: true,
              items: { select: { productName: true, quantity: true }, take: 5 },
            },
          }),
        ]);

        const total = dinheiro(resumo._sum.total);
        const compras = resumo._count._all;

        return {
          cliente: {
            nome: cliente.name,
            telefone: cliente.phone,
            email: cliente.email,
            cidade: cliente.city,
          },
          compras,
          totalGasto: total,
          ticketMedio: compras > 0 ? Number((total / compras).toFixed(2)) : 0,
          ultimaCompra:
            resumo._max.createdAt?.toISOString().slice(0, 10) ?? null,
          recentes: recentes.map((venda) => ({
            data: venda.createdAt.toISOString().slice(0, 10),
            total: dinheiro(venda.total),
            itens: venda.items.map((item) => item.productName),
          })),
        };
      },
    }),
  };
}
