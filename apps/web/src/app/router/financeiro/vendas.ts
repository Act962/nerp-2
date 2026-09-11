import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  curvaAbcDeProdutos,
  intervaloDoFiltro,
  resumoDeVendas,
  serieDeVendas,
} from "@/features/financeiro/server/relatorio-de-vendas";

/**
 * Relatório de vendas do financeiro: série no tempo, ticket médio e curva ABC.
 *
 * Duas procedures, e não uma: o resumo e a série abrem a tela e são baratos; a
 * curva ABC varre os itens de venda do período e só interessa a quem abre
 * aquela seção. Uma procedure só faria toda troca de período pagar o preço da
 * mais cara.
 */
const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

/** Os dois dias do filtro global do financeiro, inclusivos. */
const periodo = z.object({ from: z.string(), to: z.string() });

export const getRelatorioDeVendas = p
  .route({
    method: "GET",
    summary: "Vendas por período, com série e ticket médio",
    tags: ["Financeiro"],
  })
  .input(periodo.extend({ granularidade: z.enum(["dia", "mes"]) }))
  .output(
    z.object({
      resumo: z.object({
        total: z.number(),
        vendas: z.number(),
        ticketMedio: z.number(),
        descontos: z.number(),
        itens: z.number(),
      }),
      serie: z.array(
        z.object({
          inicio: z.string(),
          total: z.number(),
          vendas: z.number(),
          ticketMedio: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const intervalo = intervaloDoFiltro(input);
    const [resumo, serie] = await Promise.all([
      resumoDeVendas(context.org.id, intervalo),
      serieDeVendas(context.org.id, intervalo, input.granularidade),
    ]);
    return { resumo, serie };
  });

export const getCurvaAbc = p
  .route({
    method: "GET",
    summary: "Curva ABC dos produtos vendidos",
    tags: ["Financeiro"],
  })
  .input(periodo.extend({ criterio: z.enum(["valor", "volume"]) }))
  .output(
    z.object({
      criterio: z.enum(["valor", "volume"]),
      total: z.number(),
      classes: z.array(
        z.object({
          classe: z.enum(["A", "B", "C"]),
          itens: z.number(),
          valor: z.number(),
          volume: z.number(),
          fatia: z.number(),
        }),
      ),
      itens: z.array(
        z.object({
          produtoId: z.string(),
          nome: z.string(),
          sku: z.string().nullable(),
          valor: z.number(),
          volume: z.number(),
          classe: z.enum(["A", "B", "C"]),
          fatia: z.number(),
          acumulado: z.number(),
          posicao: z.number(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const curva = await curvaAbcDeProdutos(
      context.org.id,
      intervaloDoFiltro(input),
      input.criterio,
    );
    return {
      criterio: curva.criterio,
      total: curva.total,
      classes: curva.classes,
      itens: curva.itens,
    };
  });
