import z from "zod";
import { explorarBanco } from "@/features/mapeamento-banco/application/explorar-banco";
import { executar, procedimento } from "./_procedimento";

export const tabelasDoBanco = procedimento
  .route({
    summary: "Listar tabelas e views visíveis no banco do ERP",
    tags: ["mapeamento-banco"],
  })
  .input(z.object({}))
  .handler(async ({ context }) => executar(context.org.id, explorarBanco));
