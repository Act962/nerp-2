import z from "zod";
import { perfilarColuna } from "@/features/mapeamento-banco/application/perfilar-coluna";
import { tabelaRefSchema } from "@/features/mapeamento-banco/domain/mapeamento";
import { executar, procedimento } from "./_procedimento";

export const perfilDaColuna = procedimento
  .route({
    summary: "Perfil de uma coluna (preenchimento, distintos, formatos)",
    tags: ["mapeamento-banco"],
  })
  .input(
    z.object({
      tabela: tabelaRefSchema,
      coluna: z.string().trim().min(1).max(128),
    }),
  )
  .handler(async ({ input, context }) =>
    executar(context.org.id, (deps) => perfilarColuna(deps, input)),
  );
