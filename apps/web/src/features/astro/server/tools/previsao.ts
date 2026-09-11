import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { isErpActive } from "@/app/router/dashboard-widgets/_registry";
import { inicioDoDiaNaLoja, STORE_TZ } from "@/features/sales/lib/period-range";
import prisma from "@/lib/db";
import type { ContextoToolsApp } from "./_contexto";
import { type PontoDaSerie, preverSerie } from "../previsao";
import { serieDiaria } from "./vendas";

/**
 * Previsão de vendas.
 *
 * Quando a organização espelha um ERP externo (`SalesFactDaily`), a série vem
 * de lá: é o faturamento de verdade da rede, e não só o que passou pelo PDV
 * deste sistema. Sem ERP, vem das vendas próprias.
 *
 * O cálculo é puro e mora em `../previsao.ts` — a tool só busca a série e
 * devolve o método junto do número.
 */
export function construirToolsDePrevisao(ctx: ContextoToolsApp): ToolSet {
  const { organizationId } = ctx;

  return {
    previsaoDeVendas: tool({
      description:
        "Projeção estatística de quanto a loja deve vender nos próximos dias, com faixa de variação. Diga sempre o método e a confiança que a resposta traz.",
      inputSchema: z.object({
        horizonteDias: z
          .union([z.literal(7), z.literal(14), z.literal(30)])
          .default(7),
      }),
      execute: async ({ horizonteDias }) => {
        const hoje = inicioDoDiaNaLoja(new Date(), STORE_TZ);
        const desde = new Date(hoje.getTime() - 90 * 86_400_000);

        const comErp = await isErpActive(organizationId);
        const historico = comErp
          ? await serieDoErp(organizationId, desde)
          : (
              await serieDiaria(
                organizationId,
                { from: desde, to: hoje },
                "dia",
              )
            ).map((ponto) => ({ data: ponto.data, valor: ponto.total }));

        const previsao = preverSerie(historico, horizonteDias, hoje);

        return {
          fonte: comErp
            ? "faturamento espelhado do ERP"
            : "vendas registradas no nerp",
          metodo: previsao.metodo,
          confianca: previsao.confianca,
          diasDeHistorico: previsao.diasDeHistorico,
          mediaDiaria: previsao.media,
          totalPrevisto: previsao.total,
          dias: previsao.dias.map((dia) => ({
            data: dia.data.toISOString().slice(0, 10),
            previsto: dia.previsto,
            min: dia.min,
            max: dia.max,
          })),
        };
      },
    }),
  };
}

async function serieDoErp(
  organizationId: string,
  desde: Date,
): Promise<PontoDaSerie[]> {
  const linhas = await prisma.salesFactDaily.groupBy({
    by: ["date"],
    where: { organizationId, date: { gte: desde } },
    _sum: { revenue: true },
    orderBy: { date: "asc" },
  });
  return linhas.map((linha) => ({
    data: linha.date,
    valor: Number(linha._sum.revenue ?? 0),
  }));
}
