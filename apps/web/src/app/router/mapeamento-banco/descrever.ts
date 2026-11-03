import z from "zod";
import { descreverTabela } from "@/features/mapeamento-banco/application/descrever-tabela";
import { tabelaRefSchema } from "@/features/mapeamento-banco/domain/mapeamento";
import { executar, procedimento } from "./_procedimento";

export const descreverTabelaDoBanco = procedimento
  .route({
    summary: "Colunas, chaves, índices e relações de uma tabela do ERP",
    tags: ["mapeamento-banco"],
  })
  .input(z.object({ tabela: tabelaRefSchema }))
  .handler(async ({ input, context }) =>
    executar(context.org.id, (deps) => descreverTabela(deps, input.tabela)),
  );
