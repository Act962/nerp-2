import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
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
import { type ContextoToolsApp, dinheiro, numero } from "./_contexto";

/** Quem é a organização, o que ela tem ligado e quantos cadastros existem. */
export function construirToolsDeOperacao(ctx: ContextoToolsApp): ToolSet {
  const { organizationId } = ctx;

  return {
    minhaOperacao: tool({
      description:
        "Quem é a organização de quem fala: nome, ramo, plano, saldo e uso de Stars (★), se é conta de teste, e quantos cadastros ela tem. Chame na primeira resposta e sempre que for recomendar algo.",
      inputSchema: z.object({}),
      execute: async () => {
        const [org, { plano, origem }, cadastros] = await Promise.all([
          prisma.organization.findUniqueOrThrow({
            where: { id: organizationId },
            select: {
              name: true,
              segment: true,
              niche: true,
              interests: true,
              starsBalance: true,
              starsUsedInCycle: true,
              verifiedAt: true,
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
          nicho: org.niche,
          interesses: org.interests,
          clienteDesde: org.createdAt.toISOString().slice(0, 10),
          /** Conta de teste: sem conta de verdade, nada sai para o mundo. */
          contaDeTeste: org.verifiedAt === null,
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
          cadastros,
        };
      },
    }),

    modulosContratados: tool({
      description:
        "Quais módulos do nerp a organização tem ligados hoje, quais ela desligou e quais estão fora do plano de Trade. Use antes de recomendar módulo.",
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

    contarCadastros: tool({
      description:
        "Quantos produtos, clientes, fornecedores e lojas a organização tem, separando os dados de exemplo dos reais.",
      inputSchema: z.object({}),
      execute: async () => contarCadastros(organizationId),
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
            minStock: true,
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
            preco: dinheiro(produto.salePrice),
            precoPromocional: produto.promotionalPrice
              ? dinheiro(produto.promotionalPrice)
              : null,
            estoque: numero(produto.currentStock),
            estoqueMinimo: numero(produto.minStock),
            unidade: produto.unit,
            ativo: produto.isActive,
            exemplo: produto.isDemo,
          })),
        };
      },
    }),
  };
}

export async function contarCadastros(organizationId: string) {
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
