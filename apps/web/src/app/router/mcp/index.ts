import {
  alterarImportacaoDoToken,
  criarTokenDoMcp,
  listarTokensDoMcp,
  revogarTokenDoMcp,
} from "./tokens";

export const mcpRoutes = {
  tokens: {
    listar: listarTokensDoMcp,
    criar: criarTokenDoMcp,
    revogar: revogarTokenDoMcp,
    alterarImportacao: alterarImportacaoDoToken,
  },
};
