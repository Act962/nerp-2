import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  catalogoDaOferta,
  comporOferta,
} from "@/features/promotional-catalog/lib/compor-oferta";
import {
  type PedidoDeOferta,
  climaOfertaSchema,
} from "@/features/promotional-catalog/lib/oferta-desenhada";
import {
  gerarLogoDaOferta,
  logoDisponivel,
  precoDoLogo,
} from "@/features/promotional-catalog/server/gerar-logo";
import {
  estimarGeracao,
  etiquetaDoPedido,
  gerarOfertaAgora,
  iaDisponivel,
} from "@/features/promotional-catalog/server/gerar-oferta";
import { precoDaArte } from "@/features/promotional-catalog/server/gerar-arte";
import { resolvePromotionalProducts } from "@/features/promotional-catalog/server/resolve-products";
import { DEFAULT_CONFIG } from "@/features/promotional-catalog/types";
import { podePagar } from "@/features/stars/server/debitar";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { executarAcao } from "../acoes/registro";
import type { ContextoToolsApp } from "./_contexto";

/**
 * Gerar página de oferta — o gerador do catálogo promocional pela conversa.
 *
 * Usa o MESMO caminho do assistente da tela (`gerarOfertaAgora`, que é a
 * geração da fila rodando na hora): mesma permissão, mesma IA, mesma cobrança
 * e a mesma linha em `PromotionalOfferGeneration`. Sem chave da OpenAI, monta
 * sem IA — a oferta sai do mesmo jeito, só sem a escolha de chamada e ordem.
 *
 * A cobrança NÃO passa pelo `executarAcao` (não há `cobranca` aqui): quem
 * cobra é a geração, pelo custo real do modelo — cobrar nos dois lugares
 * seria cobrar duas vezes.
 */
export function construirToolsDeOferta(ctx: ContextoToolsApp): ToolSet {
  const { organizationId, userId } = ctx;

  return {
    gerarPaginaDeOferta: tool({
      description:
        "Gera uma página de oferta pronta (encarte A4, story ou post de feed) num catálogo promocional novo: produtos, nome da oferta, validade, estilo e logo. A IA escolhe a disposição e a chamada; o logo pode ser criado por IA. Custa ★ e precisa de aprovação na conversa.",
      inputSchema: z.object({
        nome: z
          .string()
          .min(1)
          .max(60)
          .describe('Nome da oferta, vira o título. Ex.: "Rasga Outubro"'),
        formato: z.enum(["a4", "story", "feed"]).default("story"),
        produtos: z
          .array(z.string().max(80))
          .max(24)
          .optional()
          .describe("Nomes de produtos pedidos pela pessoa, se ela citou"),
        categorias: z.array(z.string().max(60)).max(10).optional(),
        apenasPromocoes: z
          .boolean()
          .default(true)
          .describe("Sem produtos citados: usar só os que estão em promoção"),
        limite: z.number().int().min(1).max(24).default(6),
        validade: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Último dia da oferta, AAAA-MM-DD"),
        chamada: z.string().max(80).optional(),
        estilo: climaOfertaSchema
          .optional()
          .describe("Só se a pessoa pediu; vazio = a IA escolhe"),
        nivel: z.enum(["ECONOMICO", "EQUILIBRADO", "PREMIUM"]).optional(),
        logo: z.enum(["empresa", "ia", "nenhum"]).default("empresa"),
        arte: z
          .boolean()
          .default(true)
          .describe(
            "Arte premium desenhada pela IA (título 3D, fundo de designer). Desligue só se a pessoa pedir algo simples ou barato.",
          ),
        contato: z.string().max(80).optional(),
      }),
      execute: async (entrada) =>
        executarAcao(ctx, "gerarPaginaDeOferta", entrada, async () => {
          const membro = await prisma.member.findFirst({
            where: { organizationId, userId },
            select: { role: true, permissions: true },
          });
          if (!memberCan(membro, "catalogo-promocional-editar")) {
            throw new Error(
              "Você não tem permissão para criar catálogos promocionais.",
            );
          }

          const ids = await escolherProdutos(organizationId, entrada);
          const org = await prisma.organization.findUniqueOrThrow({
            where: { id: organizationId },
            select: { aiOfferLevel: true },
          });
          const nivel = entrada.nivel ?? org.aiOfferLevel;
          // Mesmo padrão do assistente: a etiqueta de preço mais recente da
          // organização, quando ela tem uma salva.
          const etiquetaSalva = await prisma.promotionalPriceStyle.findFirst({
            where: { scope: "USER", organizationId },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          const comIa = iaDisponivel(nivel);
          const comLogoIa = entrada.logo === "ia" && logoDisponivel();

          // Saldo conferido ANTES de gastar qualquer coisa: o logo cobra na
          // hora, e descobrir a falta de saldo só na oferta deixaria a pessoa
          // pagando por um logo sem página.
          const estimadas = comIa
            ? await estimarGeracao(organizationId, nivel, ids.length)
            : 0;
          const precoLogo = comLogoIa
            ? await precoDoLogo(organizationId, nivel)
            : 0;
          const precoArte =
            comIa && entrada.arte
              ? await precoDaArte(organizationId, nivel)
              : 0;
          const total = estimadas + precoLogo + precoArte;
          if (total > 0 && !(await podePagar(organizationId, total))) {
            throw new Error(
              `Saldo de ★ insuficiente — a oferta custa cerca de ${total} ★.`,
            );
          }

          let stars = 0;
          let logo: PedidoDeOferta["logo"] =
            entrada.logo === "empresa" ? { tipo: "org" } : null;
          if (comLogoIa) {
            const criado = await gerarLogoDaOferta({
              organizationId,
              userId,
              nivel,
              nome: entrada.nome,
              clima: entrada.estilo ?? "impacto",
            });
            logo = { tipo: "asset", chave: criado.chave };
            stars += criado.starsCobradas;
          }

          const pedido: PedidoDeOferta = {
            formato: entrada.formato,
            produtoIds: ids,
            oferta: {
              nome: entrada.nome,
              chamada: entrada.chamada,
              validade: entrada.validade
                ? `${entrada.validade}T23:59`
                : undefined,
              informacoes: ["Enquanto durar o estoque"],
              contato: entrada.contato,
            },
            logo,
            clima: entrada.estilo ?? "impacto",
            molde: "grade",
            arteIa: entrada.arte,
            etiquetaId: etiquetaSalva?.id,
          };

          let catalogoId: string;
          if (comIa) {
            const feito = await gerarOfertaAgora({
              organizationId,
              userId,
              nivel,
              estimadas: estimadas + precoArte,
              dados: {
                pedido,
                nome: entrada.nome,
                estiloLivre: !entrada.estilo,
              },
            });
            catalogoId = feito.catalogoId;
            stars += feito.starsCobradas;
          } else {
            const criado = await prisma.promotionalCatalog.create({
              data: {
                organizationId,
                createdById: userId,
                name: entrada.nome,
                config: catalogoDaOferta(
                  DEFAULT_CONFIG,
                  comporOferta({
                    ...pedido,
                    etiqueta: await etiquetaDoPedido(organizationId, pedido),
                  }),
                ) as object,
              },
              select: { id: true },
            });
            catalogoId = criado.id;
          }

          return {
            oferta: {
              catalogoId,
              nome: entrada.nome,
              produtos: ids.length,
              montadaComIa: comIa,
            },
            starsCobradas: stars,
            link: {
              rotulo: "Abrir a oferta",
              href: `/catalogo-promocional/${catalogoId}`,
            },
          };
        }),
    }),
  };
}

async function escolherProdutos(
  organizationId: string,
  entrada: {
    produtos?: string[];
    categorias?: string[];
    apenasPromocoes: boolean;
    limite: number;
  },
): Promise<string[]> {
  if (entrada.produtos && entrada.produtos.length > 0) {
    const achados = await Promise.all(
      entrada.produtos.map((nome) =>
        prisma.product.findFirst({
          where: {
            organizationId,
            isActive: true,
            name: { contains: nome.trim(), mode: "insensitive" },
          },
          select: { id: true },
          orderBy: { name: "asc" },
        }),
      ),
    );
    const faltando = entrada.produtos.filter((_, i) => !achados[i]);
    if (faltando.length > 0) {
      throw new Error(
        `Não encontrei no cadastro: ${faltando.join(", ")}. Confira o nome ou tire da oferta.`,
      );
    }
    return [
      ...new Set(achados.map((p) => p?.id).filter((id): id is string => !!id)),
    ];
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
      // SLUG: é por ele que `resolvePromotionalProducts` filtra.
      select: { slug: true },
    });
    if (encontradas.length === 0) {
      throw new Error(
        `Nenhuma categoria encontrada com ${entrada.categorias.join(", ")}.`,
      );
    }
    categoryFilter = encontradas.map((c) => c.slug);
  }
  const produtos = await resolvePromotionalProducts(organizationId, {
    autoPromotions: entrada.apenasPromocoes,
    categoryFilter,
    sortBy: "discount-desc",
  });
  if (produtos.length === 0) {
    throw new Error(
      entrada.apenasPromocoes
        ? "Nenhum produto está com preço promocional agora — a oferta sairia vazia. Cite os produtos ou peça sem se limitar às promoções."
        : "Nenhum produto ativo encontrado — a oferta sairia vazia.",
    );
  }
  return produtos.slice(0, entrada.limite).map((p) => p.id);
}
