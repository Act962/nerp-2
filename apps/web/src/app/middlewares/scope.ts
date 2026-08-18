import { base } from "./base";

// Exige um scope específico quando a chamada vem de uma integração S2S (Órbita).
// Chamadas normais (usuário logado, `isS2S` ausente) passam direto — o scope só
// restringe o que uma chave de integração pode ler, não o que o dono da org faz.
//
// Sem isto, `s2sScopes` (injetado em /api/rpc) fica decorativo: qualquer chave
// válida da org leria qualquer procedure, ignorando os scopes concedidos.
export const requireScope = (scope: string) =>
  base.middleware(async ({ context, next, errors }) => {
    if (context.isS2S && !context.s2sScopes?.includes(scope)) {
      throw errors.FORBIDDEN({
        message: `Integração sem permissão para o scope "${scope}"`,
      });
    }
    return next();
  });
