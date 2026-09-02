import { z } from "zod";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { maskMetaCredentials } from "@/features/whatsapp-chat/lib/providers/meta-credentials";
import { isOrgAdmin } from "@/lib/org-access";
import prisma from "@/lib/db";

/**
 * Estado da conexão de WhatsApp de um funil.
 *
 * Segredo nenhum sai daqui em claro: token, App Secret e verify token voltam
 * mascarados (`••••1234`), e só para quem é admin — para os demais o objeto de
 * credenciais vem vazio. É a mesma regra do catálogo de integrações.
 */
export const getConnection = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Estado da conexão de WhatsApp do funil",
    tags: ["WhatsApp"],
  })
  .input(z.object({ funnelId: z.string().min(1) }))
  .output(
    z.object({
      podeGerenciar: z.boolean(),
      conexao: z
        .object({
          id: z.string(),
          name: z.string(),
          status: z.enum(["CONNECTED", "DISCONNECTED"]),
          phoneNumber: z.string().nullable(),
          profileName: z.string().nullable(),
          lastError: z.string().nullable(),
          lastSyncAt: z.string().nullable(),
          credenciais: z.object({
            accessToken: z.string().nullable(),
            appSecret: z.string().nullable(),
            verifyToken: z.string().nullable(),
            phoneNumberId: z.string().nullable(),
            businessAccountId: z.string().nullable(),
          }),
        })
        .nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    await requireFunnelDaOrg(input.funnelId, organizationId);

    const podeGerenciar = await isOrgAdmin(organizationId, context.user.id);

    const conexao = await prisma.whatsAppConnection.findFirst({
      where: { funnelId: input.funnelId, organizationId },
      select: {
        id: true,
        name: true,
        status: true,
        phoneNumber: true,
        profileName: true,
        lastError: true,
        lastSyncAt: true,
        metaAccessToken: true,
        metaPhoneNumberId: true,
        metaAppSecret: true,
        metaVerifyToken: true,
        metaBusinessAccountId: true,
      },
    });

    if (!conexao) return { podeGerenciar, conexao: null };

    const mascaradas = maskMetaCredentials(conexao);

    return {
      podeGerenciar,
      conexao: {
        id: conexao.id,
        name: conexao.name,
        status: conexao.status,
        phoneNumber: conexao.phoneNumber,
        profileName: conexao.profileName,
        lastError: conexao.lastError,
        lastSyncAt: conexao.lastSyncAt?.toISOString() ?? null,
        // Quem não é admin não vê nem a máscara — máscara ainda conta os
        // quatro últimos caracteres do segredo.
        credenciais: podeGerenciar
          ? mascaradas
          : {
              accessToken: null,
              appSecret: null,
              verifyToken: null,
              phoneNumberId: mascaradas.phoneNumberId,
              businessAccountId: null,
            },
      },
    };
  });
