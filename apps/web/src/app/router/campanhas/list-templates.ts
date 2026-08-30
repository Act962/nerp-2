import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import { sanitizarErro } from "@/features/integracoes/server/credentials";
import { decryptStoredMetaCredentials } from "@/features/whatsapp-chat/lib/providers/meta-credentials";
import { modoDemoLigado } from "@/features/whatsapp-chat/lib/providers";
import prisma from "@/lib/db";
import { getMessageTemplates } from "@/lib/whatsapp-cloud";

/**
 * Templates aprovados na Meta.
 *
 * Não guardamos template no banco: ele vive lá, é aprovado lá e pode ser
 * reprovado lá a qualquer momento. Guardar uma cópia significaria oferecer
 * para disparo um template que a Meta já recusou.
 *
 * Só devolve os APROVADOS — oferecer um em análise é montar uma campanha que
 * vai falhar inteira no disparo.
 */
export const listTemplates = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Templates aprovados", tags: ["Campanhas"] })
  .input(z.object({ funnelId: z.string().min(1) }))
  .output(
    z.object({
      templates: z.array(
        z.object({
          nome: z.string(),
          idioma: z.string(),
          categoria: z.string(),
          corpo: z.string().nullable(),
          variaveis: z.number(),
        }),
      ),
      erro: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    await requireFunnelDaOrg(input.funnelId, organizationId);

    if (modoDemoLigado()) {
      // Modo demonstração: sem conta na Meta não há templates de verdade.
      return {
        templates: [
          {
            nome: "promocao_semanal",
            idioma: "pt_BR",
            categoria: "MARKETING",
            corpo: "Olá {{1}}! Esta semana temos condições especiais.",
            variaveis: 1,
          },
          {
            nome: "aviso_de_pedido",
            idioma: "pt_BR",
            categoria: "UTILITY",
            corpo: "Oi {{1}}, seu pedido {{2}} está pronto para retirada.",
            variaveis: 2,
          },
        ],
        erro: null,
      };
    }

    const conexao = await prisma.whatsAppConnection.findFirst({
      where: { funnelId: input.funnelId, organizationId },
      select: {
        metaAccessToken: true,
        metaPhoneNumberId: true,
        metaAppSecret: true,
        metaVerifyToken: true,
        metaBusinessAccountId: true,
      },
    });
    if (!conexao) {
      return { templates: [], erro: "Nenhum número conectado a este funil." };
    }

    const credenciais = decryptStoredMetaCredentials(conexao);
    if (!credenciais.businessAccountId) {
      return {
        templates: [],
        erro: "Informe o WhatsApp Business Account ID na tela de conexão.",
      };
    }

    try {
      const resposta = await getMessageTemplates(
        credenciais.accessToken,
        credenciais.businessAccountId,
      );

      const aprovados = (resposta.data ?? []).filter(
        (template) => template.status === "APPROVED",
      );

      return {
        templates: aprovados.map((template) => {
          const corpo = template.components?.find(
            (parte) => parte.type === "BODY",
          )?.text;
          // Quantas variáveis o texto pede: é o que a tela usa para saber
          // quantos campos de preenchimento mostrar.
          const variaveis = new Set(
            (corpo?.match(/\{\{(\d+)\}\}/g) ?? []).map((marca) => marca),
          ).size;
          return {
            nome: template.name,
            idioma: template.language,
            categoria: template.category ?? "MARKETING",
            corpo: corpo ?? null,
            variaveis,
          };
        }),
        erro: null,
      };
    } catch (error) {
      return {
        templates: [],
        erro: sanitizarErro(
          error instanceof Error ? error.message : "Falha ao consultar a Meta",
          [credenciais.accessToken],
        ),
      };
    }
  });
