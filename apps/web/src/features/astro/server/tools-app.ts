import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { construirTools } from "@/features/astro-consultor/server/tools";
import type { AstroPricing } from "@/features/astro-consultor/server/preco";
import { limiteDeStars } from "@/features/billing/lib/planos";
import {
  isTradeGated,
  planAllowsModule,
  resolveEffectivePlan,
} from "@/features/billing/lib/plans";
import { planoDaOrganizacao } from "@/features/billing/server/plano-da-organizacao";
import { calcularUso } from "@/features/stars/lib/uso";
import prisma from "@/lib/db";
import { SEGMENT_LABELS } from "@/lib/org-segment";
import { PAGE_PERMISSIONS } from "@/lib/permissions";

/**
 * As tools do Astro dentro do nerp.
 *
 * Todas de leitura, todas com `organizationId` vindo da closure — nunca de
 * argumento. Se o id da organização fosse parâmetro, bastaria uma mensagem
 * bem escrita para o modelo "consultar" a operação de outra empresa. É a
 * ausência do parâmetro, não uma regra do prompt, que segura isso.
 *
 * As tools do site entram todas: é o mesmo Astro, com o mesmo conhecimento
 * da ÓRBITA — e um cliente que quer mais um módulo passa pelo mesmo caminho
 * de estimativa e formulário que um visitante. O que muda é que aqui ele já
 * sabe com quem fala.
 */

export type ContextoToolsApp = {
  organizationId: string;
  userId: string;
  sessaoId: string;
  /** A tabela de preços do site, para `estimarFaixaDePreco`. */
  tabelaPrecos: AstroPricing;
  /** As últimas falas da pessoa, para a busca de ferramentas. */
  falaDoVisitante: string;
};

/** Fortaleza não tem horário de verão: o deslocamento é fixo. */
const DESLOCAMENTO_FORTALEZA_MS = -3 * 60 * 60 * 1000;

type Periodo = "hoje" | "7d" | "30d" | "mes";

export function inicioDoPeriodo(periodo: Periodo, agora = new Date()): Date {
  const local = new Date(agora.getTime() + DESLOCAMENTO_FORTALEZA_MS);
  const ano = local.getUTCFullYear();
  const mes = local.getUTCMonth();
  const dia = local.getUTCDate();
  const meiaNoiteLocal = (a: number, m: number, d: number) =>
    new Date(Date.UTC(a, m, d) - DESLOCAMENTO_FORTALEZA_MS);

  switch (periodo) {
    case "hoje":
      return meiaNoiteLocal(ano, mes, dia);
    case "7d":
      return meiaNoiteLocal(ano, mes, dia - 6);
    case "30d":
      return meiaNoiteLocal(ano, mes, dia - 29);
    case "mes":
      return meiaNoiteLocal(ano, mes, 1);
  }
}

const decimal = (valor: { toNumber(): number } | null | undefined): number =>
  valor ? valor.toNumber() : 0;

export function construirToolsDoApp(contexto: ContextoToolsApp): ToolSet {
  const { organizationId } = contexto;

  // As tools do site entram inteiras: recomendar, estimar e encaminhar ao
  // time continua sendo trabalho do consultor — só que agora para quem já é
  // cliente e quer mais.
  const doSite = construirTools({
    sessaoId: contexto.sessaoId,
    tabelaPrecos: contexto.tabelaPrecos,
    falaDoVisitante: contexto.falaDoVisitante,
  });

  return {
    ...doSite,

    minhaOperacao: tool({
      description:
        "Quem é a organização de quem fala: nome, ramo, plano, saldo e uso de Stars (★), e quantos cadastros ela tem. Chame na primeira resposta e sempre que for recomendar algo.",
      inputSchema: z.object({}),
      execute: async () => {
        const [org, { plano, origem }, contagens] = await Promise.all([
          prisma.organization.findUniqueOrThrow({
            where: { id: organizationId },
            select: {
              name: true,
              segment: true,
              starsBalance: true,
              starsUsedInCycle: true,
              createdAt: true,
            },
          }),
          planoDaOrganizacao(organizationId),
          contarCadastros(organizationId),
        ]);

        const uso = calcularUso({
          saldo: org.starsBalance,
          limite: limiteDeStars(plano),
          consumido: org.starsUsedInCycle,
        });

        return {
          organizacao: org.name,
          ramo: SEGMENT_LABELS[org.segment],
          clienteDesde: org.createdAt.toISOString().slice(0, 10),
          plano: {
            nome: plano.nome,
            gratuito: plano.gratuito,
            origem,
            limites: plano.limites,
          },
          stars: {
            saldo: uso.saldo,
            limiteDoPlano: uso.limite,
            consumidasNoCiclo: uso.consumido,
            percentualUsado: uso.percentual,
            usoExtra: uso.usoExtra,
            nivel: uso.nivel,
          },
          cadastros: contagens,
        };
      },
    }),

    modulosContratados: tool({
      description:
        "Quais módulos do nerp a organização tem ligados hoje, e quais estão desligados ou fora do plano. Use antes de recomendar módulo.",
      inputSchema: z.object({}),
      execute: async () => {
        const org = await prisma.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: {
            disabledModules: true,
            tradeSubscription: { select: { plan: true, status: true } },
          },
        });
        const planoTrade = resolveEffectivePlan(org.tradeSubscription);
        const desligados = new Set(org.disabledModules);

        const ligados: string[] = [];
        const desligadosPelaOrg: string[] = [];
        const foraDoPlano: string[] = [];
        for (const pagina of PAGE_PERMISSIONS) {
          if (desligados.has(pagina.key)) {
            desligadosPelaOrg.push(pagina.label);
          } else if (
            isTradeGated(pagina.key) &&
            !planAllowsModule(planoTrade.tier, pagina.key)
          ) {
            foraDoPlano.push(pagina.label);
          } else {
            ligados.push(pagina.label);
          }
        }
        return { ligados, desligadosPelaOrg, foraDoPlano };
      },
    }),

    buscarProdutos: tool({
      description:
        "Procura produtos no cadastro da organização por nome, SKU ou código de barras. Devolve preço, promoção e estoque.",
      inputSchema: z.object({
        termo: z.string().min(1).max(80),
        limite: z.number().int().min(1).max(10).optional(),
      }),
      execute: async ({ termo, limite }) => {
        const produtos = await prisma.product.findMany({
          where: {
            organizationId,
            OR: [
              { name: { contains: termo, mode: "insensitive" } },
              { sku: { contains: termo, mode: "insensitive" } },
              { barcode: { contains: termo } },
            ],
          },
          orderBy: { name: "asc" },
          take: limite ?? 5,
          select: {
            name: true,
            sku: true,
            barcode: true,
            salePrice: true,
            promotionalPrice: true,
            currentStock: true,
            unit: true,
            isActive: true,
            isDemo: true,
            category: { select: { name: true } },
          },
        });
        if (produtos.length === 0) {
          return {
            produtos: [],
            aviso: "Nenhum produto casou com esse termo.",
          };
        }
        return {
          produtos: produtos.map((produto) => ({
            nome: produto.name,
            sku: produto.sku,
            codigoDeBarras: produto.barcode,
            categoria: produto.category?.name ?? null,
            preco: decimal(produto.salePrice),
            precoPromocional: produto.promotionalPrice
              ? decimal(produto.promotionalPrice)
              : null,
            estoque: decimal(produto.currentStock),
            unidade: produto.unit,
            ativo: produto.isActive,
            exemplo: produto.isDemo,
          })),
        };
      },
    }),

    resumoDeVendas: tool({
      description:
        "Total vendido, quantidade de vendas e ticket médio das vendas CONCLUÍDAS num período (hoje, últimos 7 dias, últimos 30 dias ou o mês corrente), no fuso de Fortaleza.",
      inputSchema: z.object({
        periodo: z.enum(["hoje", "7d", "30d", "mes"]),
      }),
      execute: async ({ periodo }) => {
        const inicio = inicioDoPeriodo(periodo);
        const agregado = await prisma.sale.aggregate({
          where: {
            organizationId,
            status: "COMPLETED",
            completedAt: { gte: inicio },
          },
          _sum: { total: true, discount: true },
          _count: { _all: true },
        });
        const quantidade = agregado._count._all;
        const total = decimal(agregado._sum.total);
        return {
          periodo,
          desde: inicio.toISOString(),
          quantidadeDeVendas: quantidade,
          totalVendido: total,
          descontos: decimal(agregado._sum.discount),
          ticketMedio:
            quantidade > 0 ? Number((total / quantidade).toFixed(2)) : 0,
        };
      },
    }),

    contarCadastros: tool({
      description:
        "Quantos produtos, clientes, fornecedores e lojas a organização tem, separando os que são dados de exemplo dos reais.",
      inputSchema: z.object({}),
      execute: async () => contarCadastros(organizationId),
    }),
  };
}

async function contarCadastros(organizationId: string) {
  const where = { organizationId };
  const demo = { organizationId, isDemo: true };
  const [
    produtos,
    produtosDemo,
    clientes,
    clientesDemo,
    fornecedores,
    fornecedoresDemo,
    lojas,
    lojasDemo,
    membros,
  ] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.count({ where: demo }),
    prisma.customer.count({ where }),
    prisma.customer.count({ where: demo }),
    prisma.supplier.count({ where }),
    prisma.supplier.count({ where: demo }),
    prisma.store.count({ where }),
    prisma.store.count({ where: demo }),
    prisma.member.count({ where }),
  ]);

  const separar = (total: number, exemplo: number) => ({
    reais: total - exemplo,
    exemplo,
  });

  return {
    produtos: separar(produtos, produtosDemo),
    clientes: separar(clientes, clientesDemo),
    fornecedores: separar(fornecedores, fornecedoresDemo),
    lojas: separar(lojas, lojasDemo),
    membros,
  };
}
