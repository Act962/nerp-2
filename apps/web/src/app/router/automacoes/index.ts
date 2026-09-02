import { createWorkflow } from "./create";
import { getWorkflow } from "./get";
import { listRuns } from "./list-runs";
import { listWorkflows } from "./list";
import { saveGraph } from "./save-graph";
import { toggleWorkflow } from "./toggle";

/**
 * Automações do funil — gatilho, passos e histórico.
 *
 * Não existe procedure que execute: quem executa é o Inngest, a partir do
 * evento que `dispararAutomacoes` publica. Uma porta HTTP de execução seria a
 * forma mais fácil de alguém rodar mil vezes o que manda mensagem ao cliente.
 */
export const automacoesRoutes = {
  list: listWorkflows,
  get: getWorkflow,
  create: createWorkflow,
  saveGraph,
  toggle: toggleWorkflow,
  runs: listRuns,
};
