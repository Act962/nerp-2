import z from "zod";
import { executar, procedimento } from "./_procedimento";

// Esquece a estrutura guardada (1h) — para quando o DBA libera uma tabela nova
// e a equipe não quer esperar o cache vencer.
export const atualizarEstrutura = procedimento
  .route({
    summary: "Recarregar a estrutura do banco do ERP",
    tags: ["mapeamento-banco"],
  })
  .input(z.object({}))
  .handler(async ({ context }) =>
    executar(context.org.id, async (deps) => {
      deps.banco.esquecerEstrutura();
      return { ok: true as const };
    }),
  );
