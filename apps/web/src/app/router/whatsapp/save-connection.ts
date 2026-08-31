import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireFunnelDaOrg } from "@/app/router/crm/_access";
import { encryptMetaCredentialsInput } from "@/features/whatsapp-chat/lib/providers/meta-credentials";
import { invalidateOutboundProvider } from "@/features/whatsapp-chat/lib/providers/resolve-outbound-provider";
import prisma from "@/lib/db";
import { isOrgAdmin } from "@/lib/org-access";

/**
 * Grava as credenciais da Meta de um funil.
 *
 * Campo de segredo em branco significa **"mantém o que está guardado"**, não
 * "apaga": sem isso, salvar o formulário só para trocar o nome do número
 * zeraria o token e derrubaria o atendimento. É a mesma convenção do catálogo
 * de integrações.
 */
export const saveConnection = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Conecta ou atualiza o número de WhatsApp do funil",
    tags: ["WhatsApp"],
  })
  .input(
    z.object({
      funnelId: z.string().min(1),
      name: z.string().trim().min(1, "Dê um nome para esta conexão"),
      /** Público — identifica o número e roteia o webhook. Obrigatório. */
      phoneNumberId: z.string().trim().min(1, "Informe o Phone Number ID"),
      businessAccountId: z.string().trim().optional(),
      /** Em branco = mantém o guardado. */
      accessToken: z.string().optional(),
      appSecret: z.string().optional(),
      verifyToken: z.string().optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;

    if (!(await isOrgAdmin(organizationId, context.user.id))) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas administradores podem conectar um número.",
      });
    }

    await requireFunnelDaOrg(input.funnelId, organizationId);

    // `metaPhoneNumberId` é único na plataforma inteira — é a chave que o
    // webhook usa para descobrir de quem é a mensagem. Se outra organização já
    // registrou este número, avisamos aqui em vez de deixar estourar como erro
    // de banco.
    const jaUsado = await prisma.whatsAppConnection.findUnique({
      where: { metaPhoneNumberId: input.phoneNumberId },
      select: { id: true, organizationId: true, funnelId: true },
    });
    if (
      jaUsado &&
      !(
        jaUsado.organizationId === organizationId &&
        jaUsado.funnelId === input.funnelId
      )
    ) {
      throw errors.BAD_REQUEST({
        message:
          "Este número já está conectado em outro funil. Um número de WhatsApp atende um funil por vez.",
      });
    }

    const existente = await prisma.whatsAppConnection.findFirst({
      where: { funnelId: input.funnelId, organizationId },
      select: { id: true },
    });

    // Campo ausente vira `undefined` no helper, que o omite do `data` — é
    // assim que "não mexer" se distingue de "limpar".
    const credenciais = encryptMetaCredentialsInput({
      accessToken: input.accessToken?.trim() ? input.accessToken : undefined,
      appSecret: input.appSecret?.trim() ? input.appSecret : undefined,
      verifyToken: input.verifyToken?.trim() ? input.verifyToken : undefined,
      phoneNumberId: input.phoneNumberId,
      businessAccountId: input.businessAccountId?.trim()
        ? input.businessAccountId
        : undefined,
    });

    if (!existente && !credenciais.metaAccessToken) {
      throw errors.BAD_REQUEST({
        message: "Informe o token de acesso da Meta para conectar o número.",
      });
    }

    const salva = existente
      ? await prisma.whatsAppConnection.update({
          where: { id: existente.id },
          data: { name: input.name, ...credenciais },
          select: { id: true },
        })
      : await prisma.whatsAppConnection.create({
          data: {
            organizationId,
            funnelId: input.funnelId,
            name: input.name,
            ...credenciais,
          },
          select: { id: true },
        });

    // O resolvedor guarda credencial por 30 segundos. Sem isto, o envio
    // seguiria com a credencial antiga por meio minuto depois de trocada.
    invalidateOutboundProvider(organizationId, input.funnelId);

    return { id: salva.id };
  });
