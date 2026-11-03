import z from "zod";
import {
  estadoDoMapeamento,
  salvarMapeamento,
  sugerirMapeamento,
  testarMapeamento,
} from "@/features/mapeamento-banco/application/mapear";
import { TIPOS_DO_NERP } from "@/features/mapeamento-banco/domain/alvos";
import { configDoTipoSchema } from "@/features/mapeamento-banco/domain/mapeamento";
import { executar, procedimento } from "./_procedimento";

const tipo = z.enum(TIPOS_DO_NERP);
const tags = ["mapeamento-banco"];

export const lerMapeamento = procedimento
  .route({ summary: "Estado do mapeamento de cada tipo", tags })
  .input(z.object({}))
  .handler(async ({ context }) => executar(context.org.id, estadoDoMapeamento));

export const sugerirMapeamentoDoTipo = procedimento
  .route({ summary: "Origem que o perfil automático usaria", tags })
  .input(z.object({ tipo }))
  .handler(async ({ input, context }) =>
    executar(context.org.id, (deps) => sugerirMapeamento(deps, input.tipo)),
  );

export const testarMapeamentoDoTipo = procedimento
  .route({ summary: "Ler poucas linhas pelo mapeamento", tags })
  .input(
    z.object({
      tipo,
      rascunho: configDoTipoSchema.nullable().default(null),
      codigo: z.string().trim().max(40).nullable().default(null),
    }),
  )
  .handler(async ({ input, context }) =>
    executar(context.org.id, (deps) =>
      testarMapeamento(deps, input.tipo, input.rascunho, input.codigo),
    ),
  );

export const salvarMapeamentoDoTipo = procedimento
  .route({ summary: "Salvar o mapeamento de um tipo", tags })
  .input(z.object({ tipo, config: configDoTipoSchema }))
  .handler(async ({ input, context }) =>
    executar(context.org.id, (deps) =>
      salvarMapeamento(deps, input.tipo, input.config),
    ),
  );
