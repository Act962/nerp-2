import z from "zod";
import {
  PAGINA_MAXIMA,
  amostrarTabela,
} from "@/features/mapeamento-banco/application/amostrar-tabela";
import { tabelaRefSchema } from "@/features/mapeamento-banco/domain/mapeamento";
import { executar, procedimento } from "./_procedimento";

// Nomes de coluna aqui são só chaves de busca: o caso de uso confere cada um
// contra a estrutura da tabela antes de qualquer SQL.
const nomeDeColuna = z.string().trim().min(1).max(128);

export const amostraDaTabela = procedimento
  .route({
    summary: "Primeiras linhas de uma tabela do ERP",
    tags: ["mapeamento-banco"],
  })
  .input(
    z.object({
      tabela: tabelaRefSchema,
      colunas: z.array(nomeDeColuna).max(500).optional(),
      filtro: z
        .object({ coluna: nomeDeColuna, valor: z.string().max(200) })
        .nullable()
        .optional(),
      ordem: z
        .object({ coluna: nomeDeColuna, direcao: z.enum(["asc", "desc"]) })
        .nullable()
        .optional(),
      pagina: z
        .number()
        .int()
        .min(0)
        .max(PAGINA_MAXIMA + 1)
        .default(0),
    }),
  )
  .handler(async ({ input, context }) =>
    executar(context.org.id, (deps) => amostrarTabela(deps, input)),
  );
