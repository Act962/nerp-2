import prisma from "@/lib/db";
import { z } from "zod";
import { p } from "./_shared";

/**
 * Resolve VÁRIOS códigos de uma vez, para a importação de itens por planilha.
 *
 * `products.findByCode` já faz isso para um código só — usá-lo em laço numa
 * planilha de 300 linhas seriam 300 idas ao banco e 300 travessias de rede.
 * Aqui é uma consulta só.
 *
 * Código que não casa simplesmente não volta: quem decide o que fazer com a
 * linha órfã é a tela, que a lista como ignorada em vez de inventar produto.
 */
export const findProductsByCodes = p
  .input(
    z.object({
      // O teto existe para o `IN` não virar uma consulta gigante; a tela avisa
      // antes de chegar aqui.
      codes: z.array(z.string().min(1)).min(1).max(1000),
    }),
  )
  .output(
    z.object({
      products: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          sku: z.string().nullable(),
          barcode: z.string().nullable(),
          unit: z.string(),
          costPrice: z.number(),
          salePrice: z.number(),
          currentStock: z.number(),
          trackStock: z.boolean(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const codes = [
      ...new Set(input.codes.map((code) => code.trim()).filter(Boolean)),
    ];
    if (codes.length === 0) return { products: [] };

    const products = await prisma.product.findMany({
      // `organizationId` no WHERE, não só nos códigos: multi-tenancy aqui é
      // manual, e código de barras é global — sem isto a planilha de um
      // inquilino resolveria produto de outro.
      where: {
        organizationId: context.org.id,
        OR: [{ barcode: { in: codes } }, { sku: { in: codes } }],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unit: true,
        costPrice: true,
        salePrice: true,
        currentStock: true,
        trackStock: true,
      },
    });

    return {
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unit: product.unit,
        costPrice: Number(product.costPrice),
        salePrice: Number(product.salePrice),
        currentStock: Number(product.currentStock),
        trackStock: product.trackStock,
      })),
    };
  });
