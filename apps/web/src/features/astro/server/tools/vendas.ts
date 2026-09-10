import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { STORE_TZ } from "@/features/sales/lib/period-range";
import { whereVendaValida } from "@/features/sales/lib/venda-valida";
import prisma from "@/lib/db";
import { calcularTicketUsual, METODO_DO_TICKET } from "../ticket-usual";
import { type ContextoToolsApp, dinheiro, numero } from "./_contexto";
import {
  intervaloAnterior,
  intervaloDoPeriodo,
  PERIODOS,
  ROTULO_DO_PERIODO,
} from "../periodo";

/**
 * Vendas: quanto, quando e o que puxou.
 *
 * Toda contagem usa `whereVendaValida` — a mesma régua de status e data que o
 * resto do sistema — e o fuso da loja. `SaleItem` não tem `organizationId`,
 * então tudo o que agrega por item passa obrigatoriamente pela venda.
 */
export function construirToolsDeVendas(ctx: ContextoToolsApp): ToolSet {
  const { organizationId } = ctx;

  return {
    resumoDeVendas: tool({
      description:
        "Total vendido, quantidade de vendas e ticket médio de um período, comparado com o período anterior de mesmo tamanho.",
      inputSchema: z.object({ periodo: z.enum(PERIODOS) }),
      execute: async ({ periodo }) => {
        const intervalo = intervaloDoPeriodo(periodo);
        const anterior = intervaloAnterior(intervalo);

        const [atual, passado] = await Promise.all([
          prisma.sale.aggregate({
            where: whereVendaValida(organizationId, intervalo),
            _sum: { total: true, discount: true },
            _count: { _all: true },
          }),
          prisma.sale.aggregate({
            where: whereVendaValida(organizationId, anterior),
            _sum: { total: true },
            _count: { _all: true },
          }),
        ]);

        const total = dinheiro(atual._sum.total);
        const quantidade = atual._count._all;
        const totalAnterior = dinheiro(passado._sum.total);

        return {
          periodo: ROTULO_DO_PERIODO[periodo],
          desde: intervalo.from.toISOString(),
          ate: intervalo.to.toISOString(),
          totalVendido: total,
          quantidadeDeVendas: quantidade,
          ticketMedio:
            quantidade > 0 ? Number((total / quantidade).toFixed(2)) : 0,
          descontos: dinheiro(atual._sum.discount),
          comparacao: {
            totalAnterior,
            quantidadeAnterior: passado._count._all,
            variacaoPercentual:
              totalAnterior > 0
                ? Number(
                    (((total - totalAnterior) / totalAnterior) * 100).toFixed(
                      1,
                    ),
                  )
                : null,
          },
        };
      },
    }),

    serieDeVendas: tool({
      description:
        "A série de vendas dia a dia (ou semana a semana) de um período, para ver tendência e comparar dias.",
      inputSchema: z.object({
        periodo: z.enum(PERIODOS),
        granularidade: z.enum(["dia", "semana"]).default("dia"),
      }),
      execute: async ({ periodo, granularidade }) => {
        const intervalo = intervaloDoPeriodo(periodo);
        const serie = await serieDiaria(
          organizationId,
          intervalo,
          granularidade,
        );
        return {
          periodo: ROTULO_DO_PERIODO[periodo],
          granularidade,
          pontos: serie.map((ponto) => ({
            data: ponto.data.toISOString().slice(0, 10),
            total: ponto.total,
            vendas: ponto.vendas,
          })),
        };
      },
    }),

    vendasAbaixoDoTicketUsual: tool({
      description:
        "Dias em que o ticket médio ficou abaixo do usual da loja. O usual é a média dos últimos 90 dias; 'abaixo' é menos que a média menos um desvio-padrão.",
      inputSchema: z.object({ periodo: z.enum(PERIODOS).default("30d") }),
      execute: async ({ periodo }) => {
        const noventaDias = intervaloDoPeriodo("30d");
        const base = {
          from: new Date(noventaDias.from.getTime() - 60 * 86_400_000),
          to: noventaDias.to,
        };
        const historico = await serieDiaria(organizationId, base, "dia");
        const tickets = historico
          .filter((ponto) => ponto.vendas > 0)
          .map((ponto) => ponto.total / ponto.vendas);

        const usual = calcularTicketUsual(tickets);
        if (!usual) {
          return {
            aviso:
              "Ainda não há dias de venda suficientes para dizer qual é o ticket usual desta loja.",
            diasAnalisados: tickets.length,
          };
        }
        const { media, corte } = usual;

        const intervalo = intervaloDoPeriodo(periodo);
        const doPeriodo = historico.filter(
          (ponto) =>
            ponto.data >= intervalo.from &&
            ponto.data < intervalo.to &&
            ponto.vendas > 0,
        );

        return {
          metodo: METODO_DO_TICKET,
          ticketUsual: Number(media.toFixed(2)),
          corte: Number(corte.toFixed(2)),
          periodo: ROTULO_DO_PERIODO[periodo],
          diasAbaixo: doPeriodo
            .map((ponto) => ({
              data: ponto.data.toISOString().slice(0, 10),
              ticket: Number((ponto.total / ponto.vendas).toFixed(2)),
              vendas: ponto.vendas,
            }))
            .filter((dia) => dia.ticket < corte),
        };
      },
    }),

    produtosMaisVendidos: tool({
      description:
        "Os produtos que mais saíram num período, por quantidade e por valor.",
      inputSchema: z.object({
        periodo: z.enum(PERIODOS).default("30d"),
        limite: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ periodo, limite }) => {
        const intervalo = intervaloDoPeriodo(periodo);
        // `SaleItem` não tem `organizationId`: o filtro passa pela venda.
        const itens = await prisma.saleItem.groupBy({
          by: ["productId", "productName"],
          where: { sale: whereVendaValida(organizationId, intervalo) },
          _sum: { quantity: true, total: true },
          orderBy: { _sum: { total: "desc" } },
          take: limite,
        });

        return {
          periodo: ROTULO_DO_PERIODO[periodo],
          produtos: itens.map((item) => ({
            nome: item.productName,
            quantidade: numero(item._sum.quantity),
            total: dinheiro(item._sum.total),
          })),
        };
      },
    }),
  };
}

export interface PontoDeVenda {
  data: Date;
  total: number;
  vendas: number;
}

/**
 * A série agrupada por dia (ou semana) no fuso da loja.
 *
 * `$queryRaw` porque o `groupBy` do Prisma não sabe truncar data com fuso, e
 * agrupar em memória exigiria trazer todas as vendas do período. O
 * `organizationId` entra como parâmetro, nunca interpolado.
 */
export async function serieDiaria(
  organizationId: string,
  intervalo: { from: Date; to: Date },
  granularidade: "dia" | "semana" = "dia",
): Promise<PontoDeVenda[]> {
  const unidade = granularidade === "semana" ? "week" : "day";
  const linhas = await prisma.$queryRaw<
    { balde: Date; total: number | null; vendas: bigint }[]
  >`
    SELECT date_trunc(${unidade}, "createdAt" AT TIME ZONE ${STORE_TZ}) AS balde,
           SUM("total")::float8 AS total,
           COUNT(*) AS vendas
      FROM "sales"
     WHERE "organizationId" = ${organizationId}
       AND "status" IN ('CONFIRMED', 'PROCESSING', 'COMPLETED')
       AND "createdAt" >= ${intervalo.from}
       AND "createdAt" < ${intervalo.to}
     GROUP BY balde
     ORDER BY balde ASC
  `;

  return linhas.map((linha) => ({
    data: new Date(linha.balde),
    total: Number((linha.total ?? 0).toFixed(2)),
    vendas: Number(linha.vendas),
  }));
}
