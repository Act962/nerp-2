import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  ASTRO_PRECOS_KEY,
  lerTabelaDePrecos,
} from "@/features/astro-consultor/server/preco";
import prisma from "@/lib/db";

/**
 * O preço avulso de cada ferramenta, para o comparativo da tela de planos.
 *
 * Lê a MESMA chave `astro-precos` que o consultor do site usa, mas por uma
 * porta própria: `site.astro.getPricing` exige administrador do SITE e devolve
 * a configuração inteira do Astro junto. Alargar aquela guarda para o cliente
 * poder ver o comparativo daria a qualquer membro de qualquer organização
 * acesso à configuração do consultor.
 *
 * O que sai daqui é só a faixa por módulo — a mesma informação comercial que o
 * consultor já diz a um visitante anônimo do site.
 */
export const precosAvulsos = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Faixa de preço avulso por ferramenta",
    tags: ["Planos"],
  })
  .input(z.object({}))
  .output(
    z.object({
      /** Falso enquanto a tabela não foi cadastrada: a tela não mostra número. */
      ativo: z.boolean(),
      modulos: z.array(
        z.object({
          toolId: z.string(),
          minCents: z.number(),
          maxCents: z.number(),
        }),
      ),
    }),
  )
  .handler(async () => {
    const linha = await prisma.siteSetting.findUnique({
      where: { key: ASTRO_PRECOS_KEY },
    });
    const tabela = lerTabelaDePrecos(linha?.value);
    return {
      ativo: tabela.ativo,
      modulos: tabela.modulos.map((modulo) => ({
        toolId: modulo.toolId,
        minCents: modulo.minCents,
        maxCents: modulo.maxCents,
      })),
    };
  });
