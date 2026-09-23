import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import prisma from "@/lib/db";

/**
 * O que o Astro alcança dentro de UMA loja.
 *
 * Três decisões seguram esta superfície:
 *
 * 1. `organizationId` vive em CLOSURE, nunca como argumento de tool. Fosse
 *    parâmetro, uma mensagem bem escrita leria o catálogo de outro inquilino —
 *    a multi-tenancy deste app é manual, e uma tool é entrada de usuário como
 *    qualquer outra.
 * 2. Só leitura, e só do que já é público. O filtro é o mesmo da vitrine
 *    (`isActive` + `showInCatalog`, estoque conforme a configuração): o que o
 *    visitante não veria navegando não sai pela conversa.
 * 3. Preço respeita `showPrices`. Catálogo com preço escondido é decisão
 *    comercial da loja, e ela não pode cair porque alguém perguntou ao Astro.
 */

export type ContextoDaVitrine = {
  organizationId: string;
  mostraPrecos: boolean;
  mostraProdutoSemEstoque: boolean;
};

/** Quantos produtos uma busca devolve. Mais que isto é lista, não resposta. */
const MAX_RESULTADOS = 8;

export function construirToolsDaLoja(contexto: ContextoDaVitrine): ToolSet {
  const filtroPublico = {
    organizationId: contexto.organizationId,
    isActive: true,
    showInCatalog: true,
    ...(contexto.mostraProdutoSemEstoque ? {} : { currentStock: { gte: 1 } }),
  };

  /** O preço de tabela resolvido para quantidade 1, como a vitrine mostra. */
  async function precos(ids: string[]): Promise<Map<string, number>> {
    if (!contexto.mostraPrecos || ids.length === 0) return new Map();
    const resolvidos = await resolveManyPrices({
      organizationId: contexto.organizationId,
      priceListId: null,
      items: ids.map((productId) => ({ productId, quantity: 1 })),
    });
    return new Map(resolvidos.map((item) => [item.productId, item.unitPrice]));
  }

  return {
    buscarProdutos: tool({
      description:
        "Procura produtos NESTA loja pelo que o cliente descreveu. Use sempre antes de dizer que a loja tem ou não tem alguma coisa — você não sabe o catálogo de cabeça.",
      inputSchema: z.object({
        termo: z
          .string()
          .max(120)
          .describe("O que o cliente procura, com as palavras dele."),
        categoria: z
          .string()
          .max(120)
          .optional()
          .describe("Nome da categoria, quando ele restringiu a uma."),
      }),
      execute: async ({ termo, categoria }) => {
        const encontrados = await prisma.product.findMany({
          where: {
            ...filtroPublico,
            ...(termo
              ? { name: { contains: termo, mode: "insensitive" } }
              : {}),
            ...(categoria
              ? {
                  category: {
                    name: { contains: categoria, mode: "insensitive" },
                  },
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            slug: true,
            currentStock: true,
            category: { select: { name: true } },
          },
          take: MAX_RESULTADOS,
          orderBy: { name: "asc" },
        });

        const tabela = await precos(encontrados.map((item) => item.id));

        return {
          quantidade: encontrados.length,
          produtos: encontrados.map((produto) => ({
            nome: produto.name,
            slug: produto.slug,
            categoria: produto.category?.name ?? null,
            preco: tabela.get(produto.id) ?? null,
            disponivel: Number(produto.currentStock) > 0,
          })),
        };
      },
    }),

    detalharProduto: tool({
      description:
        "Os detalhes de um produto desta loja, pelo `slug` que veio de `buscarProdutos`.",
      inputSchema: z.object({ slug: z.string().max(200) }),
      execute: async ({ slug }) => {
        const produto = await prisma.product.findFirst({
          where: { ...filtroPublico, slug },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            currentStock: true,
            category: { select: { name: true } },
          },
        });
        if (!produto) return { erro: "Produto não encontrado nesta loja." };

        const tabela = await precos([produto.id]);

        return {
          nome: produto.name,
          slug: produto.slug,
          categoria: produto.category?.name ?? null,
          // A descrição é TipTap serializado; o texto puro é o que serve à
          // conversa, e é ele que cabe no orçamento de tokens da resposta.
          descricao: textoDaDescricao(produto.description).slice(0, 600),
          preco: tabela.get(produto.id) ?? null,
          disponivel: Number(produto.currentStock) > 0,
        };
      },
    }),

    listarCategorias: tool({
      description:
        "As categorias desta loja, com quantos produtos publicados cada uma tem. Use quando o cliente quiser saber o que a loja vende, sem procurar nada específico.",
      inputSchema: z.object({}),
      execute: async () => {
        const categorias = await prisma.category.findMany({
          where: { organizationId: contexto.organizationId, isActive: true },
          select: {
            name: true,
            _count: { select: { products: { where: filtroPublico } } },
          },
          orderBy: { order: "asc" },
          take: 40,
        });

        return {
          categorias: categorias
            .filter((categoria) => categoria._count.products > 0)
            .map((categoria) => ({
              nome: categoria.name,
              produtos: categoria._count.products,
            })),
        };
      },
    }),
  };
}

/**
 * O texto de uma descrição de produto.
 *
 * O campo guarda JSON do editor; quando não guarda, é texto puro de um
 * cadastro antigo. Tirar as chaves e colchetes na mão (e não pelo
 * `generateText` do TipTap) mantém esta camada fora do pacote de editor, que
 * é de cliente.
 */
function textoDaDescricao(bruto: string | null): string {
  if (!bruto) return "";
  if (!bruto.trimStart().startsWith("{")) return bruto;
  try {
    const pedacos: string[] = [];
    const visitar = (no: unknown): void => {
      if (!no || typeof no !== "object") return;
      const atual = no as { text?: unknown; content?: unknown };
      if (typeof atual.text === "string") pedacos.push(atual.text);
      if (Array.isArray(atual.content)) atual.content.forEach(visitar);
    };
    visitar(JSON.parse(bruto));
    return pedacos.join(" ");
  } catch {
    return bruto;
  }
}
