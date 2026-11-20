import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { podePagar } from "@/features/stars/server/debitar";
import { climaOfertaSchema } from "@/features/promotional-catalog/lib/oferta-desenhada";
import {
  gerarLogoDaOferta,
  logoDisponivel,
  precoDoLogo,
} from "@/features/promotional-catalog/server/gerar-logo";
import { assertCanEditCatalog } from "./_require-edit";

// Logo da oferta criado pela IA (OpenAI). Síncrono: a imagem leva alguns
// segundos e o assistente espera por ela — é uma imagem, não uma fila.
export const offerLogoGenerate = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Gerar o logo da oferta com IA",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      nome: z.string().min(1, "Dê um nome à oferta").max(60),
      nivel: z.enum(["ECONOMICO", "EQUILIBRADO", "PREMIUM"]),
      clima: climaOfertaSchema,
      corBase: z
        .string()
        .regex(/^#[0-9a-f]{6}$/i)
        .optional(),
      instrucoes: z.string().max(200).optional(),
    }),
  )
  .output(
    z.object({ chave: z.string(), url: z.string(), starsCobradas: z.number() }),
  )
  .handler(async ({ input, context, errors }) => {
    await assertCanEditCatalog(context.org.id, context.user.id, errors);
    if (!logoDisponivel()) {
      throw errors.BAD_REQUEST({
        message:
          "A geração de imagem não está configurada (falta a chave da OpenAI)",
      });
    }
    const preco = await precoDoLogo(context.org.id, input.nivel);
    if (preco > 0 && !(await podePagar(context.org.id, preco))) {
      throw errors.BAD_REQUEST({
        message: `Saldo de ★ insuficiente — o logo custa cerca de ${preco} ★`,
      });
    }
    try {
      return await gerarLogoDaOferta({
        organizationId: context.org.id,
        userId: context.user.id,
        nivel: input.nivel,
        nome: input.nome,
        clima: input.clima,
        corBase: input.corBase,
        instrucoes: input.instrucoes,
      });
    } catch (falha) {
      throw errors.BAD_REQUEST({
        message:
          falha instanceof Error
            ? falha.message
            : "Não foi possível gerar o logo",
      });
    }
  });
