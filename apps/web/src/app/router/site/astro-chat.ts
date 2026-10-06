import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireSiteAdminMiddleware } from "@/app/middlewares/site-admin";
import {
  DOMINIO_DO_SITE,
  SERVIDOR_DO_CHAT,
} from "@/features/astro-consultor/server/atendimento";
import { testarAstroChat } from "@/features/site/server/astro-chat";
import {
  ASTRO_CHAT_KEY,
  LIMITE_DO_CODIGO,
  lerAstroChatGuardado,
  lerCodigoDoAstroChat,
} from "@/features/site/server/astro-chat-codigo";
import prisma from "@/lib/db";

/**
 * O código do ASTRO CHAT que põe o ASTRO do Órbita no site.
 *
 * Global como as demais `site_*`: o site é um só. Com o código salvo, o
 * `/api/site/content` passa a entregar a chave, e o `apps/site` carrega o
 * widget do Órbita no lugar do consultor daqui. Sem código, tudo volta a ser
 * como era — é o que permite desfazer a troca por esta mesma tela.
 */

const siteAdmin = base
  .use(requireAuthMiddleware)
  .use(requireSiteAdminMiddleware);

const testeSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    empresa: z.string().nullable(),
    assistente: z.string().nullable(),
  }),
  z.object({
    ok: z.literal(false),
    motivo: z.enum([
      "chave_desconhecida",
      "dominio_nao_permitido",
      "pausado",
      "sem_tracking",
      "indisponivel",
    ]),
  }),
]);

export const getAstroChat = siteAdmin
  .input(z.object({}))
  .output(
    z.object({
      codigo: z.string(),
      /** Há código salvo: quem atende no site é o ASTRO do Órbita. */
      ligado: z.boolean(),
      /** Onde copiar o código, e o domínio que tem de estar liberado lá. */
      servidor: z.string(),
      dominio: z.string(),
    }),
  )
  .handler(async () => {
    const linha = await prisma.siteSetting.findUnique({
      where: { key: ASTRO_CHAT_KEY },
      select: { value: true },
    });
    const guardado = lerAstroChatGuardado(linha?.value);
    return {
      codigo: guardado?.codigo ?? "",
      ligado: Boolean(guardado),
      servidor: SERVIDOR_DO_CHAT,
      dominio: DOMINIO_DO_SITE,
    };
  });

export const saveAstroChat = siteAdmin
  .input(z.object({ codigo: z.string().max(LIMITE_DO_CODIGO) }))
  .output(
    z.object({
      /** Código em branco devolve o site ao consultor daqui. */
      ligado: z.boolean(),
      teste: testeSchema.nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (context.siteAdmin.role === "REDATOR") {
      throw errors.FORBIDDEN({
        message: "Redator não troca o Astro do site",
      });
    }

    const lido = lerCodigoDoAstroChat(input.codigo, SERVIDOR_DO_CHAT);

    if (!lido.ok && lido.motivo === "vazio") {
      await prisma.siteSetting.deleteMany({ where: { key: ASTRO_CHAT_KEY } });
      return { ligado: false, teste: null };
    }
    if (!lido.ok && lido.motivo === "outro_servidor") {
      throw errors.BAD_REQUEST({
        message: `Este código não é do Órbita (${SERVIDOR_DO_CHAT}). Copie o da aba Instalação do ASTRO CHAT.`,
      });
    }
    if (!lido.ok) {
      throw errors.BAD_REQUEST({
        message:
          "Não achei a chave neste código. Cole a linha inteira da aba Instalação do ASTRO CHAT.",
      });
    }

    const value = { codigo: input.codigo.trim(), chave: lido.chave };
    await prisma.siteSetting.upsert({
      where: { key: ASTRO_CHAT_KEY },
      create: { key: ASTRO_CHAT_KEY, value },
      update: { value },
    });

    // Salva primeiro e testa depois: o teste depende do Órbita estar no ar, e
    // um Órbita fora do ar não é motivo para perder o que o admin colou.
    return { ligado: true, teste: await testarAstroChat(lido.chave) };
  });
