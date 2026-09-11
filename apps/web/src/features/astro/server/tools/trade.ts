import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import prisma from "@/lib/db";
import { type ContextoToolsApp, dinheiro } from "./_contexto";

/**
 * Trade Marketing: o estado da operação de campo.
 *
 * Não reaproveita `getTradeDashboard` porque aquele procedure devolve 26
 * indicadores desenhados para a tela; aqui a resposta é falada, e o que
 * importa é o punhado que muda uma decisão. As consultas são as mesmas, todas
 * escopadas por `organizationId`.
 */
export function construirToolsDeTrade(ctx: ContextoToolsApp): ToolSet {
  const { organizationId } = ctx;

  return {
    painelDeTrade: tool({
      description:
        "O panorama do Trade Marketing: lojas e mapas, espaços livres/executados/pendentes, fotos de PDV aguardando aprovação, books, negociações e valor negociado.",
      inputSchema: z.object({}),
      execute: async () => {
        const [
          lojas,
          lojasSemMapa,
          espacos,
          fotos,
          fotosPendentes,
          books,
          booksProntos,
          promotores,
          negociacoes,
          negociacoesFechadas,
          valorNegociado,
        ] = await Promise.all([
          prisma.store.count({ where: { organizationId } }),
          prisma.store.count({
            where: { organizationId, floorPlans: { none: {} } },
          }),
          prisma.mapObject.groupBy({
            by: ["spaceState"],
            where: { organizationId },
            _count: true,
          }),
          prisma.pdvPhoto.count({ where: { organizationId } }),
          prisma.pdvPhoto.count({
            where: { organizationId, approvalStatus: "PENDING" },
          }),
          prisma.book.count({ where: { organizationId } }),
          prisma.book.count({ where: { organizationId, status: "READY" } }),
          prisma.promoterStore.findMany({
            where: { organizationId },
            select: { memberId: true },
            distinct: ["memberId"],
          }),
          prisma.spaceNegotiation.count({ where: { organizationId } }),
          prisma.spaceNegotiation.count({
            where: { organizationId, status: "FECHADA" },
          }),
          prisma.spaceNegotiation.aggregate({
            where: { organizationId, status: "FECHADA" },
            _sum: { amount: true },
          }),
        ]);

        const porEstado = Object.fromEntries(
          espacos.map((estado) => [estado.spaceState, estado._count]),
        );

        return {
          lojas,
          lojasSemMapa,
          espacos: {
            livres: porEstado.LIVRE ?? 0,
            executados: porEstado.EXECUTADO ?? 0,
            pendentes: porEstado.PENDENTE ?? 0,
          },
          fotosDePdv: fotos,
          fotosAguardandoAprovacao: fotosPendentes,
          books,
          booksProntos,
          promotoresEmCampo: promotores.length,
          negociacoes,
          negociacoesFechadas,
          valorNegociado: dinheiro(valorNegociado._sum.amount),
        };
      },
    }),

    contratosVencendo: tool({
      description:
        "Negociações de espaço fechadas que vencem nos próximos N dias — o que precisa ser renovado.",
      inputSchema: z.object({
        dias: z.number().int().min(1).max(365).default(30),
      }),
      execute: async ({ dias }) => {
        const agora = new Date();
        const ate = new Date(agora.getTime() + dias * 86_400_000);

        const contratos = await prisma.spaceNegotiation.findMany({
          where: {
            organizationId,
            status: "FECHADA",
            endDate: { gte: agora, lte: ate },
          },
          orderBy: { endDate: "asc" },
          take: 20,
          select: {
            endDate: true,
            amount: true,
            // A loja do contrato vem pelo ponto do mapa: negociação é de um
            // espaço, e o espaço pertence à planta de uma loja.
            mapObject: {
              select: {
                name: true,
                floorPlan: {
                  select: { store: { select: { name: true, city: true } } },
                },
              },
            },
            supplier: { select: { name: true } },
            brand: { select: { name: true } },
          },
        });

        return {
          janela: `próximos ${dias} dias`,
          contratos: contratos.map((contrato) => ({
            loja: contrato.mapObject?.floorPlan?.store?.name ?? null,
            cidade: contrato.mapObject?.floorPlan?.store?.city ?? null,
            espaco: contrato.mapObject?.name ?? null,
            industria: contrato.supplier?.name ?? null,
            marca: contrato.brand?.name ?? null,
            vence: contrato.endDate?.toISOString().slice(0, 10) ?? null,
            valor: dinheiro(contrato.amount),
          })),
        };
      },
    }),
  };
}
