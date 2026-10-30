import { gtinValido, resolverTributacao } from "@nerp/fiscal";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { carregarPerfilTributario } from "@/features/fiscal/server/cadastro-fiscal";
import prisma from "@/lib/db";
import { z } from "zod";

// Quantos produtos já podem sair em nota fiscal, e o que falta nos outros.
//
// Roda a MESMA regra (`resolverTributacao`) que a montagem da nota vai usar:
// produto que aparece aqui como pronto não pode ser recusado na hora de
// emitir. Por isso a avaliação é em memória, não em `where` do Prisma —
// formato e padrão da empresa não cabem num filtro de banco. Só seleciona os
// campos fiscais, então mesmo um catálogo de dezenas de milhares é leve.

const LIMITE_ITENS = 300;

const CAMPOS_CONTADOS = [
  "ncm",
  "cfop",
  "cstIcms",
  "cstPis",
  "cstCofins",
] as const;

const pendenciaSchema = z.object({ campo: z.string(), mensagem: z.string() });

export const productFiscalReadiness = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ search: z.string().optional() }).optional())
  .output(
    z.object({
      regime: z.string().nullable(),
      total: z.number(),
      prontos: z.number(),
      pendentes: z.number(),
      porCampo: z.object({
        ncm: z.number(),
        cfop: z.number(),
        cstIcms: z.number(),
        cstPis: z.number(),
        cstCofins: z.number(),
        formato: z.number(),
      }),
      // Sem código de barras válido o item sai como "SEM GTIN" — não bloqueia.
      semGtin: z.number(),
      itens: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          sku: z.string().nullable(),
          ncm: z.string().nullable(),
          cfop: z.string().nullable(),
          cstIcms: z.string().nullable(),
          pendencias: z.array(pendenciaSchema),
        }),
      ),
      truncado: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    const perfil = await carregarPerfilTributario(context.org.id);
    // Sem regime cadastrado a tela avisa; até lá avalia como Simples, que é o
    // caso de quase todo varejo pequeno.
    const regime = perfil.regime ?? "SIMPLES_NACIONAL";
    const search = input?.search?.trim();

    const produtos = await prisma.product.findMany({
      where: {
        organizationId: context.org.id,
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { sku: { contains: search, mode: "insensitive" as const } },
                { barcode: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        ncm: true,
        cest: true,
        cfop: true,
        origem: true,
        cstIcms: true,
        cstPis: true,
        cstCofins: true,
        cClassTrib: true,
        cstIbsCbs: true,
      },
      orderBy: { name: "asc" },
    });

    const porCampo = {
      ncm: 0,
      cfop: 0,
      cstIcms: 0,
      cstPis: 0,
      cstCofins: 0,
      formato: 0,
    };
    let prontos = 0;
    let semGtin = 0;
    const itens: z.infer<typeof pendenciaSchema>[][] = [];
    const pendentesIdx: number[] = [];

    produtos.forEach((produto, i) => {
      if (!produto.barcode || !gtinValido(produto.barcode)) semGtin += 1;
      const r = resolverTributacao(produto, perfil.padroes, regime);
      if (r.ok) {
        prontos += 1;
        return;
      }
      if (r.motivo === "FORMATO") porCampo.formato += 1;
      else
        for (const p of r.pendencias) {
          const campo = CAMPOS_CONTADOS.find((c) => c === p.campo);
          if (campo) porCampo[campo] += 1;
        }
      pendentesIdx.push(i);
      itens.push(r.pendencias);
    });

    return {
      regime: perfil.regime,
      total: produtos.length,
      prontos,
      pendentes: pendentesIdx.length,
      porCampo,
      semGtin,
      itens: pendentesIdx.slice(0, LIMITE_ITENS).map((idx, n) => {
        const p = produtos[idx];
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          ncm: p.ncm,
          cfop: p.cfop,
          cstIcms: p.cstIcms,
          pendencias: itens[n],
        };
      }),
      truncado: pendentesIdx.length > LIMITE_ITENS,
    };
  });
