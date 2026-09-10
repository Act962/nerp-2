import { criarSandboxProcedure } from "./criar-sandbox";
import { removerDadosDeExemplo } from "./remover-dados-de-exemplo";
import { status } from "./status";

export const onboardingRoutes = {
  status,
  removerDadosDeExemplo,
  criarSandbox: criarSandboxProcedure,
};
