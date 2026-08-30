import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { requireCampanhaDaOrg } from "./_access";

/** Fixa qual template a campanha vai disparar. */
export const setTemplate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Escolhe o template", tags: ["Campanhas"] })
  .input(
    z.object({
      broadcastId: z.string().min(1),
      nome: z.string().min(1),
      idioma: z.string().min(1),
      categoria: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
      /** Valor fixo de cada variável do template, na ordem. */
      variaveis: z.array(z.string()).optional(),
    }),
  )
  .output(z.object({ id: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const campanha = await requireCampanhaDaOrg(
      input.broadcastId,
      context.org.id,
    );

    if (campanha.status !== "DRAFT" && campanha.status !== "SCHEDULED") {
      throw errors.BAD_REQUEST({
        message:
          "O template só muda enquanto a campanha não começou a disparar.",
      });
    }

    await prisma.broadcast.update({
      where: { id: campanha.id },
      data: {
        templateName: input.nome,
        templateLanguage: input.idioma,
        templateCategory: input.categoria,
        templateVariables: input.variaveis ?? [],
      },
    });

    return { id: campanha.id };
  });
