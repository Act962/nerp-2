import z from "zod";
import { executar, procedimento } from "./_procedimento";

// Cabeçalho da página: qual banco, de qual ERP, e se a credencial responde.
// O teste de conexão falhar não é erro da procedure — a tela mostra o motivo.
export const conexaoDoBanco = procedimento
  .route({
    summary: "Descrever a conexão com o banco do ERP",
    tags: ["mapeamento-banco"],
  })
  .input(z.object({}))
  .handler(async ({ context }) =>
    executar(context.org.id, async (deps) => {
      let mensagem: string | null = null;
      try {
        await deps.banco.testarConexao();
      } catch (erro) {
        mensagem = deps.banco.explicarFalha(erro);
      }
      return {
        ...deps.banco.descricao,
        erp: deps.vocabulario.nome,
        conectado: mensagem === null,
        mensagem,
      };
    }),
  );
