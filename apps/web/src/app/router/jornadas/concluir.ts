import { z } from "zod";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  concluirJornada,
  JornadaApressadaError,
  JornadaNaoIniciadaError,
} from "@/features/jornadas/server/concluir";

/**
 * Fecha a jornada e credita as ★ da empresa, quando for o caso.
 *
 * `tempos` chega só como telemetria — quanto a pessoa gastou em cada passo,
 * para o admin enxergar onde o texto está longo demais. Quem decide se houve
 * pressa é o servidor, com o `iniciadaEm` que ele mesmo gravou.
 */
export const concluir = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", summary: "Concluir jornada", tags: ["Jornadas"] })
  .input(
    z.object({
      jornadaId: z.string().min(1),
      apressos: z.number().int().min(0).max(999),
      tempos: z.array(z.number().min(0)).max(200).default([]),
    }),
  )
  .output(
    z.object({
      starsCreditadas: z.number(),
      resgatadaPor: z.string().nullable(),
      motivo: z.enum([
        "creditada",
        "ja_resgatada",
        "jornada_sem_stars",
        "org_nao_elegivel",
        "ja_concluida",
      ]),
      saldo: z.number().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await concluirJornada({
        organizationId: context.org.id,
        userId: context.user.id,
        jornadaId: input.jornadaId,
        apressos: input.apressos,
      });
    } catch (erro) {
      if (erro instanceof JornadaApressadaError) {
        const segundos = Math.ceil(erro.faltamMs / 1000);
        throw errors.BAD_REQUEST({
          message: `Calma! As ★ só vêm pra quem faz passo a passo. Faltam uns ${segundos}s de jornada.`,
        });
      }
      if (erro instanceof JornadaNaoIniciadaError) {
        throw errors.NOT_FOUND({
          message: "Comece a jornada antes de concluir",
        });
      }
      throw erro;
    }
  });
