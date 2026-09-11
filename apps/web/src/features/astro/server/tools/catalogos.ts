import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { resolvePromotionalProducts } from "@/features/promotional-catalog/server/resolve-products";
import prisma from "@/lib/db";
import { type ContextoToolsApp, dinheiro } from "./_contexto";

/**
 * Catálogos promocionais: o que existe e o que entraria num catálogo novo.
 *
 * `previaDeCatalogo` é só leitura — usa a MESMA seleção de produtos que a
 * criação usaria (`resolvePromotionalProducts`), então o que o Astro mostra
 * aqui é exatamente o que sairia no encarte. Criar de verdade fica para a
 * fase das ações, com aprovação na conversa.
 */
export function construirToolsDeCatalogos(ctx: ContextoToolsApp): ToolSet {
  const { organizationId } = ctx;

  return {
    listarCatalogosPromocionais: tool({
      description:
        "Os catálogos promocionais da organização, do mais recente para o mais antigo.",
      inputSchema: z.object({
        limite: z.number().int().min(1).max(20).default(10),
      }),
      execute: async ({ limite }) => {
        const catalogos = await prisma.promotionalCatalog.findMany({
          where: { organizationId },
          orderBy: { updatedAt: "desc" },
          take: limite,
          select: {
            name: true,
            isDemo: true,
            createdAt: true,
            updatedAt: true,
            createdBy: { select: { name: true } },
          },
        });
        return {
          catalogos: catalogos.map((catalogo) => ({
            nome: catalogo.name,
            criadoPor: catalogo.createdBy?.name ?? null,
            criadoEm: catalogo.createdAt.toISOString().slice(0, 10),
            atualizadoEm: catalogo.updatedAt.toISOString().slice(0, 10),
            exemplo: catalogo.isDemo,
          })),
        };
      },
    }),

    previaDeCatalogo: tool({
      description:
        "Quais produtos entrariam num catálogo promocional montado agora, pelo critério dado. Só mostra — não cria nada.",
      inputSchema: z.object({
        apenasPromocoes: z.boolean().default(true),
        categorias: z.array(z.string().max(60)).max(10).optional(),
        ordenacao: z
          .enum([
            "discount-desc",
            "price-asc",
            "price-desc",
            "name-asc",
            "savings-desc",
          ])
          .default("discount-desc"),
        limite: z.number().int().min(1).max(40).default(20),
      }),
      execute: async ({ apenasPromocoes, categorias, ordenacao, limite }) => {
        // O critério vem por NOME de categoria (é o que a pessoa fala); os ids
        // são resolvidos aqui dentro, já filtrados pela organização.
        let categoryFilter: string[] | undefined;
        if (categorias && categorias.length > 0) {
          const encontradas = await prisma.category.findMany({
            where: {
              organizationId,
              OR: categorias.map((nome) => ({
                name: { contains: nome, mode: "insensitive" as const },
              })),
            },
            // SLUG, e não id: é por ele que `resolvePromotionalProducts`
            // filtra, e é o que a config do catálogo guarda.
            select: { slug: true, name: true },
          });
          if (encontradas.length === 0) {
            return {
              erro: `Nenhuma categoria encontrada com ${categorias.join(", ")}.`,
            };
          }
          categoryFilter = encontradas.map((c) => c.slug);
        }

        const produtos = await resolvePromotionalProducts(organizationId, {
          autoPromotions: apenasPromocoes,
          categoryFilter,
          sortBy: ordenacao,
        });

        return {
          criterio: {
            apenasPromocoes,
            categorias: categorias ?? null,
            ordenacao,
          },
          total: produtos.length,
          produtos: produtos.slice(0, limite).map((produto) => ({
            nome: produto.name,
            categoria: produto.categoryName ?? null,
            preco: dinheiro(produto.salePrice),
            precoPromocional: produto.promotionalPrice
              ? dinheiro(produto.promotionalPrice)
              : null,
            desconto: produto.discount ?? null,
            temFoto: Boolean(produto.thumbnail),
          })),
        };
      },
    }),
  };
}
