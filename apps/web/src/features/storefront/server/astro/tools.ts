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
  /** Vitrine com carrinho: o Astro pode pôr produto no pedido e levar a finalizar. */
  aceitaPedidos: boolean;
};

/** Teto por item: pedido de atacado cabe; número absurdo vindo do modelo, não. */
const MAX_QUANTIDADE = 9999;

/** Quantos produtos uma busca devolve. Mais que isto é lista, não resposta. */
const MAX_RESULTADOS = 8;
/** Candidatos lidos quando nenhum produto tem todas as palavras (depois ranqueados). */
const MAX_CANDIDATOS = 40;

/** Palavras que o cliente escreve e que não estão no nome de produto nenhum. */
const PALAVRAS_VAZIAS = new Set([
  "a",
  "o",
  "as",
  "os",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "um",
  "uma",
  "com",
  "pra",
  "para",
  "por",
  "e",
  "quero",
  "queria",
  "tem",
  "voce",
  "voces",
  "me",
  "ve",
  "manda",
  "preciso",
  "gostaria",
  "unidade",
  "unidades",
  "un",
]);

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * "Quero 2 leite em pó Camponesa 1kg" → ["leite", "pó", "camponesa", "1kg"]. A
 * frase inteira quase nunca aparece igual no nome ("LEITE EM PO CAMPONESA
 * INSTANTANEO 1KG UN"); palavra a palavra, sim.
 */
export function palavrasDaBusca(termo: string): string[] {
  const palavras = termo
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((palavra) => palavra.length >= 2 && !/^\d+$/.test(palavra))
    .filter((palavra) => !PALAVRAS_VAZIAS.has(semAcento(palavra)));
  return [...new Set(palavras)];
}

/** A palavra como o cliente escreveu ou sem acento ("pó" acha "PO"; "açúcar" acha "AÇÚCAR"). */
function nomeContem(palavra: string) {
  const variantes = [...new Set([palavra, semAcento(palavra)])];
  return {
    OR: variantes.map((variante) => ({
      name: { contains: variante, mode: "insensitive" as const },
    })),
  };
}

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

  /**
   * Pôr no pedido e levar a finalizar. O carrinho mora no navegador do cliente:
   * a tool só confere o produto (o mesmo filtro público da vitrine) e devolve a
   * ação para a vitrine executar — o servidor não grava nada.
   */
  function ferramentasDoPedido(): ToolSet {
    return {
      colocarNoCarrinho: tool({
        description:
          'Põe um produto no pedido do cliente, pelo `slug` que veio de `buscarProdutos`. Use quando ele disser que quer levar ("quero 2", "pode colocar"). Quantidade em unidades.',
        inputSchema: z.object({
          slug: z.string().max(200),
          quantidade: z.number().int().min(1).max(MAX_QUANTIDADE),
        }),
        execute: async ({ slug, quantidade }) => {
          const produto = await prisma.product.findFirst({
            where: { ...filtroPublico, slug },
            select: { id: true, name: true },
          });
          if (!produto) return { erro: "Produto não encontrado nesta loja." };
          return {
            ok: true,
            nome: produto.name,
            quantidade,
            acaoNoCliente: {
              tipo: "adicionar_ao_carrinho",
              productId: produto.id,
              quantidade,
            },
            botao: {
              rotulo: "Ver meu pedido",
              acao: { tipo: "abrir_carrinho" },
            },
          };
        },
      }),

      finalizarPedido: tool({
        description:
          'Leva o cliente a finalizar o pedido quando ele terminar de escolher. Mostra o botão; no fim do pedido aparece "Enviar pedido pelo WhatsApp", que leva ao WhatsApp da loja.',
        inputSchema: z.object({}),
        execute: async () => ({
          ok: true,
          botao: {
            rotulo: "Finalizar pedido",
            acao: { tipo: "finalizar_pedido" },
          },
        }),
      }),
    };
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
        const palavras = palavrasDaBusca(termo);
        const filtroDaCategoria = categoria
          ? {
              category: {
                name: { contains: categoria, mode: "insensitive" as const },
              },
            }
          : {};
        const campos = {
          id: true,
          name: true,
          slug: true,
          currentStock: true,
          category: { select: { name: true } },
        } as const;

        let encontrados = await prisma.product.findMany({
          where: {
            ...filtroPublico,
            ...filtroDaCategoria,
            ...(palavras.length > 0 ? { AND: palavras.map(nomeContem) } : {}),
          },
          select: campos,
          take: MAX_RESULTADOS,
          orderBy: { name: "asc" },
        });

        // Nenhum com todas as palavras: os que têm mais delas ("camponesa 2kg" ainda acha a de 1kg).
        if (encontrados.length === 0 && palavras.length > 1) {
          const candidatos = await prisma.product.findMany({
            where: {
              ...filtroPublico,
              ...filtroDaCategoria,
              OR: palavras.map(nomeContem),
            },
            select: campos,
            take: MAX_CANDIDATOS,
            orderBy: { name: "asc" },
          });
          const acertos = (nome: string) => {
            const nomeNormalizado = semAcento(nome.toLowerCase());
            return palavras.filter((palavra) =>
              nomeNormalizado.includes(semAcento(palavra)),
            ).length;
          };
          encontrados = candidatos
            .map((produto) => ({ produto, pontos: acertos(produto.name) }))
            .sort((left, right) => right.pontos - left.pontos)
            .slice(0, MAX_RESULTADOS)
            .map(({ produto }) => produto);
        }

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

    ...(contexto.aceitaPedidos ? ferramentasDoPedido() : {}),

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
