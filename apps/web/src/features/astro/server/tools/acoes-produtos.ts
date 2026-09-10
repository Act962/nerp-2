import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { uploadImageFromUrl } from "@/features/products/server/upload-image-from-url";
import { chaveDoAnexo } from "../anexos";
import prisma from "@/lib/db";
import { memberCan } from "@/lib/permissions";
import { executarAcao } from "../acoes/registro";
import type { ContextoToolsApp } from "./_contexto";

/**
 * Colocar imagem num produto a partir de um endereço.
 *
 * O arquivo é baixado e guardado no bucket da organização (o mesmo caminho da
 * importação de produtos), nunca referenciado de fora: uma imagem hospedada em
 * outro lugar some do catálogo no dia em que aquele site cair.
 *
 * Anexo enviado na conversa e imagem gerada pelo Astro entram por aqui também:
 * elas JÁ estão no prefixo da organização, então a chave é aproveitada como
 * está, sem uma segunda cópia do mesmo arquivo dentro do bucket.
 */
export function construirToolsDeAcaoDeProdutos(ctx: ContextoToolsApp): ToolSet {
  const { organizationId, userId } = ctx;

  return {
    adicionarImagemAoProduto: tool({
      description:
        "Baixa uma imagem de um endereço e adiciona ao produto. Precisa de aprovação na conversa.",
      inputSchema: z.object({
        produto: z.string().min(1).max(80).describe("Nome ou SKU do produto."),
        url: z.string().url().max(500),
        virarCapa: z.boolean().default(true),
      }),
      execute: async (entrada) =>
        executarAcao(ctx, "adicionarImagemAoProduto", entrada, async () => {
          const membro = await prisma.member.findFirst({
            where: { organizationId, userId },
            select: { role: true, permissions: true },
          });
          if (!memberCan(membro, "produtos")) {
            throw new Error("Você não tem permissão para editar produtos.");
          }

          const produto = await prisma.product.findFirst({
            where: {
              organizationId,
              OR: [
                { name: { contains: entrada.produto, mode: "insensitive" } },
                { sku: { contains: entrada.produto, mode: "insensitive" } },
              ],
            },
            select: { id: true, name: true, images: true, thumbnail: true },
          });
          if (!produto) {
            throw new Error(
              `Nenhum produto encontrado com "${entrada.produto}".`,
            );
          }

          const chave =
            chaveDoAnexo(entrada.url, organizationId) ??
            (await uploadImageFromUrl(entrada.url));
          if (!chave) {
            throw new Error(
              "Não consegui baixar essa imagem. Confira se o endereço abre uma imagem de até 5 MB.",
            );
          }

          const atualizado = await prisma.product.update({
            where: { id: produto.id },
            data: {
              images: [...new Set([...produto.images, chave])],
              ...(entrada.virarCapa || !produto.thumbnail
                ? { thumbnail: chave }
                : {}),
            },
            select: { images: true, thumbnail: true },
          });

          return {
            produto: produto.name,
            imagens: atualizado.images.length,
            virouCapa: atualizado.thumbnail === chave,
            link: {
              rotulo: "Abrir o produto",
              href: `/produtos/${produto.id}`,
            },
          };
        }),
    }),
  };
}
