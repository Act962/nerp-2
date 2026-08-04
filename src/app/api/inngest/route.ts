import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

/**
 * Cada invocação executa UM step. O padrão da plataforma é curto demais para os
 * steps pesados (lote de importação, render do PDF do Book) e um step que não
 * termina nunca é memoizado — o Inngest o reexecuta desde o começo. Este teto
 * dá a folga; quem garante que o trabalho cabe é o fatiamento em lotes.
 */
export const maxDuration = 300;

/**
 * Endpoint que o Inngest usa para descobrir e executar as funções deste app.
 * O `src/middleware.ts` já exclui `/api`, então não há bloqueio de auth aqui.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
