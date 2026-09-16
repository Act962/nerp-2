import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { prefixoPublicoDaOrg } from "@/features/astro/server/anexos";
import { MAX_IMAGENS_POR_MELHORIA } from "@/features/jornadas/lib/limites";
import prisma from "@/lib/db";

/**
 * A sugestão de melhoria que sai do painel do Astro.
 *
 * Vai para uma tabela GLOBAL (`site_melhorias`): o pedido é para a equipe da
 * ÓRBITA, não é dado da empresa — e precisa sobreviver à empresa, porque
 * sandbox expira em 30 dias e o que ela apontou continua valendo.
 *
 * O nome de quem pediu vai COPIADO pelo mesmo motivo.
 */
export const enviar = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Enviar melhoria", tags: ["Melhorias"] })
  .input(
    z.object({
      pathname: z.string().min(1).max(300),
      mensagem: z.string().min(10).max(2000),
      imagens: z
        .array(z.string().url())
        .max(MAX_IMAGENS_POR_MELHORIA)
        .default([]),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    if (input.imagens.length > 0) {
      // Só entra print que ESTA empresa subiu. Sem esta conferência, uma
      // requisição forjada penduraria no chamado a imagem de outra empresa —
      // e a tela do admin a mostraria como se fosse desta.
      const prefixo = prefixoPublicoDaOrg(context.org.id);
      if (!prefixo || input.imagens.some((url) => !url.startsWith(prefixo))) {
        throw errors.BAD_REQUEST({
          message: "Imagem fora do endereço desta empresa",
        });
      }
    }

    const melhoria = await prisma.siteMelhoria.create({
      data: {
        organizationId: context.org.id,
        organizationName: context.org.name,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        // A tela em que a pessoa estava é metade do pedido: "não achei o
        // botão" sem a rota é um bilhete sem endereço.
        pathname: input.pathname.slice(0, 300),
        mensagem: input.mensagem,
        imagens: input.imagens,
      },
      select: { id: true },
    });

    return { id: melhoria.id };
  });
