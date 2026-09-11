import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { DEFAULT_CONFIG } from "@/features/promotional-catalog/types";
import { resolvePromotionalProducts } from "@/features/promotional-catalog/server/resolve-products";
import { ACOES } from "@/features/stars/lib/acoes-chaves";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { executarAcao } from "../acoes/registro";
import type { ContextoToolsApp } from "./_contexto";

/**
 * Criar catálogo promocional — a primeira coisa que o Astro escreve.
 *
 * Passa pela MESMA permissão da tela (`catalogo-promocional-editar`) e pela
 * mesma seleção de produtos (`resolvePromotionalProducts`): o Astro não faz o
 * que a pessoa não poderia fazer sozinha, e o encarte sai igual ao que a tela
 * montaria. A aprovação na conversa é configurada em `acoes/aprovacao.ts`.
 */
export function construirToolsDeAcaoDeCatalogo(ctx: ContextoToolsApp): ToolSet {
  const { organizationId, userId } = ctx;

  return {
    criarCatalogoPromocional: tool({
      description:
        "Cria um catálogo promocional com os produtos em promoção da organização. Precisa de aprovação na conversa antes de executar.",
      inputSchema: z.object({
        nome: z.string().min(1).max(80),
        categorias: z.array(z.string().max(60)).max(10).optional(),
        apenasPromocoes: z.boolean().default(true),
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
      execute: async (entrada) =>
        executarAcao(
          ctx,
          "criarCatalogoPromocional",
          entrada,
          async () => {
            const membro = await prisma.member.findFirst({
              where: { organizationId, userId },
              select: { role: true, permissions: true },
            });
            if (!memberCan(membro, "catalogo-promocional-editar")) {
              throw new Error(
                "Você não tem permissão para criar catálogos promocionais.",
              );
            }

            let categoryFilter: string[] | undefined;
            if (entrada.categorias && entrada.categorias.length > 0) {
              const encontradas = await prisma.category.findMany({
                where: {
                  organizationId,
                  OR: entrada.categorias.map((nome) => ({
                    name: { contains: nome, mode: "insensitive" as const },
                  })),
                },
                select: { id: true },
              });
              if (encontradas.length === 0) {
                throw new Error(
                  `Nenhuma categoria encontrada com ${entrada.categorias.join(", ")}.`,
                );
              }
              categoryFilter = encontradas.map((c) => c.id);
            }

            const produtos = await resolvePromotionalProducts(organizationId, {
              autoPromotions: entrada.apenasPromocoes,
              categoryFilter,
              sortBy: entrada.ordenacao,
            });
            if (produtos.length === 0) {
              throw new Error(
                "Nenhum produto atende a esse critério — o catálogo sairia vazio.",
              );
            }

            const escolhidos = produtos.slice(0, entrada.limite);
            const catalogo = await prisma.promotionalCatalog.create({
              data: {
                organizationId,
                createdById: userId,
                name: entrada.nome,
                config: {
                  ...DEFAULT_CONFIG,
                  title: entrada.nome,
                  showTitle: true,
                  sortBy: entrada.ordenacao,
                  manuallyAddedIds: escolhidos.map((produto) => produto.id),
                } as object,
              },
              select: { id: true, name: true },
            });

            return {
              catalogo: {
                id: catalogo.id,
                nome: catalogo.name,
                produtos: escolhidos.length,
              },
              // O widget desenha isto como botão; o modelo nunca escreve o
              // caminho, que é como um link do Astro sai errado.
              link: {
                rotulo: "Abrir o catálogo",
                href: `/catalogo-promocional/${catalogo.id}`,
              },
            };
          },
          {
            actionKey: ACOES.astroCatalogo,
            descricao: `Astro — catálogo "${entrada.nome}"`,
          },
        ),
    }),
  };
}
