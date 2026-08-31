import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import { sanitizarErro } from "@/features/integracoes/server/credentials";
import { decryptStoredMetaCredentials } from "@/features/whatsapp-chat/lib/providers/meta-credentials";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";
import { getPhoneNumbers } from "@/lib/whatsapp-cloud";

/**
 * Confere se a credencial guardada realmente fala com a Meta.
 *
 * Chama a Graph de leitura pura (`/{wabaId}/phone_numbers`), grava o resultado
 * em `status` e devolve o que achou. É o botão "Testar conexão" — sem ele o
 * operador só descobre que a credencial está errada quando um cliente manda
 * mensagem e ninguém responde.
 *
 * Qualquer mensagem de erro do provedor passa por `sanitizarErro` antes de
 * chegar à tela ou ao banco: a Graph às vezes ecoa parte do token na
 * descrição do erro.
 */
export const testConnection = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Testa a credencial contra a Meta",
    tags: ["WhatsApp"],
  })
  .input(z.object({ funnelId: z.string().min(1) }))
  .output(
    z.object({
      ok: z.boolean(),
      erro: z.string().nullable(),
      numeros: z.array(
        z.object({
          id: z.string(),
          displayPhoneNumber: z.string().nullable(),
          verifiedName: z.string().nullable(),
          qualityRating: z.string().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;

    if (!(await isOrgAdmin(organizationId, context.user.id))) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas administradores podem testar a conexão.",
      });
    }

    await requireFunnelDaOrg(input.funnelId, organizationId);

    const conexao = await prisma.whatsAppConnection.findFirst({
      where: { funnelId: input.funnelId, organizationId },
      select: {
        id: true,
        metaAccessToken: true,
        metaPhoneNumberId: true,
        metaAppSecret: true,
        metaVerifyToken: true,
        metaBusinessAccountId: true,
      },
    });

    if (!conexao) {
      throw errors.NOT_FOUND({
        message: "Nenhum número conectado a este funil",
      });
    }

    const credenciais = decryptStoredMetaCredentials(conexao);
    if (!credenciais.businessAccountId) {
      throw errors.BAD_REQUEST({
        message:
          "Informe o WhatsApp Business Account ID (WABA) para poder testar a conexão.",
      });
    }

    const segredos = [credenciais.accessToken];

    try {
      const resposta = await getPhoneNumbers({
        wabaId: credenciais.businessAccountId,
        accessToken: credenciais.accessToken,
      });

      const numeros = (resposta.data ?? []).map((numero) => ({
        id: numero.id,
        displayPhoneNumber: numero.display_phone_number ?? null,
        verifiedName: numero.verified_name ?? null,
        qualityRating: numero.quality_rating ?? null,
      }));

      // Só marca conectado se o número configurado estiver mesmo na conta —
      // credencial válida de OUTRA conta passaria no teste sem isso.
      const confere = numeros.some(
        (numero) => numero.id === credenciais.phoneNumberId,
      );

      const desteNumero = numeros.find(
        (numero) => numero.id === credenciais.phoneNumberId,
      );

      await prisma.whatsAppConnection.update({
        where: { id: conexao.id },
        data: {
          status: confere ? "CONNECTED" : "DISCONNECTED",
          phoneNumber: desteNumero?.displayPhoneNumber ?? null,
          profileName: desteNumero?.verifiedName ?? null,
          lastSyncAt: new Date(),
          lastError: confere
            ? null
            : "O Phone Number ID configurado não está nesta conta do WhatsApp Business.",
          lastErrorAt: confere ? null : new Date(),
        },
      });

      return {
        ok: confere,
        erro: confere
          ? null
          : "O Phone Number ID configurado não está nesta conta do WhatsApp Business.",
        numeros,
      };
    } catch (error) {
      const mensagem = sanitizarErro(
        error instanceof Error ? error.message : "Falha ao falar com a Meta",
        segredos,
      );

      await prisma.whatsAppConnection.update({
        where: { id: conexao.id },
        data: {
          status: "DISCONNECTED",
          lastError: mensagem,
          lastErrorAt: new Date(),
        },
      });

      return { ok: false, erro: mensagem, numeros: [] };
    }
  });
