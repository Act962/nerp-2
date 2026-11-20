import z from "zod";
import { diagramaDoSchema } from "@/features/mapeamento-banco/application/diagrama";
import { executar, procedimento } from "./_procedimento";

export const diagramaDoBanco = procedimento
  .route({
    summary: "Tabelas e ligações de um schema, para o diagrama",
    tags: ["mapeamento-banco"],
  })
  .input(
    z.object({
      // Só chave de busca: o caso de uso confere contra a lista de schemas.
      schema: z
        .string()
        .regex(/^[A-Za-z_][A-Za-z0-9_$#]{0,127}$/)
        .nullable()
        .default(null),
    }),
  )
  .handler(async ({ input, context }) =>
    executar(context.org.id, (deps) => diagramaDoSchema(deps, input.schema)),
  );
