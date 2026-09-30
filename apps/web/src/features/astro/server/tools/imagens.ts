import "server-only";

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { inicioDoDiaNaLoja, STORE_TZ } from "@/features/sales/lib/period-range";
import {
  googleDisponivel,
  openaiDisponivel,
} from "@/features/astro-consultor/server/provider";
import { ACOES } from "@/features/stars/lib/acoes-chaves";
import prisma from "@/lib/db";
import { executarAcao } from "../acoes/registro";
import { COTA_DIARIA_DE_IMAGENS, gerarEGuardarImagem } from "../gerar-imagem";
import type { ContextoToolsApp } from "./_contexto";

/**
 * Gerar imagem.
 *
 * Existe quando quem atende tem modelo de imagem: o Google, ou a OpenAI com
 * chave (`gpt-image-1-mini`). Fora disso, a tool nem entra no conjunto — o
 * modelo não fica com a opção de prometer o que não consegue entregar.
 *
 * A cota diária é contada em `AstroAcao`, que já é o registro de toda ação de
 * escrita: sem tabela nova, e o que conta é imagem que SAIU (linha sem erro).
 */
export function construirToolsDeImagem(ctx: ContextoToolsApp): ToolSet {
  const modelo = ctx.modelo;
  const temImagem =
    !!modelo?.google ||
    (modelo?.provedor === "openai" &&
      (!!openaiDisponivel() || !!googleDisponivel()));
  if (!modelo || !temImagem) return {};

  return {
    gerarImagem: tool({
      description:
        "Gera uma imagem a partir de uma descrição e guarda no acervo da organização. Use para fundo de catálogo, arte de campanha ou foto ilustrativa de produto. Precisa de aprovação na conversa e consome ★.",
      inputSchema: z.object({
        descricao: z
          .string()
          .min(8)
          .max(600)
          .describe(
            "O que a imagem mostra, em detalhe: objeto, cenário, luz, cores.",
          ),
        finalidade: z
          .enum(["fundo_de_catalogo", "arte_de_campanha", "produto", "outro"])
          .default("outro"),
        proporcao: z.enum(["1:1", "4:5", "16:9", "9:16"]).default("1:1"),
      }),
      execute: async (entrada) =>
        executarAcao(
          ctx,
          "gerarImagem",
          entrada,
          async () => {
            const usadasHoje = await prisma.astroAcao.count({
              where: {
                organizationId: ctx.organizationId,
                // A cota é por organização e vale para toda imagem gerada —
                // o logo do gerador de oferta conta junto.
                tool: { in: ["gerarImagem", "gerarLogoDeOferta"] },
                erro: null,
                createdAt: { gte: inicioDoDiaNaLoja(new Date(), STORE_TZ) },
              },
            });
            if (usadasHoje >= COTA_DIARIA_DE_IMAGENS) {
              throw new Error(
                `A organização já gerou ${COTA_DIARIA_DE_IMAGENS} imagens hoje — o limite volta amanhã.`,
              );
            }

            const imagem = await gerarEGuardarImagem({
              organizationId: ctx.organizationId,
              modelo,
              descricao: entrada.descricao,
              proporcao: entrada.proporcao,
            });

            return {
              imagem: {
                url: imagem.url,
                chave: imagem.chave,
                descricao: entrada.descricao,
              },
              restantesHoje: COTA_DIARIA_DE_IMAGENS - usadasHoje - 1,
              // O endereço da imagem serve para `adicionarImagemAoProduto`,
              // que reconhece o prefixo da própria organização e aproveita o
              // arquivo em vez de baixá-lo de novo.
              proximoPasso:
                "Para usar num produto, chame adicionarImagemAoProduto com este mesmo endereço.",
            };
          },
          {
            actionKey: ACOES.astroImagem,
            descricao: `Astro — imagem gerada (${entrada.finalidade})`,
          },
        ),
    }),
  };
}
