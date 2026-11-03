// O MCP do NERP é a porta de entrada de agentes de IA (Claude, Cursor, o
// próprio Astro no futuro). Cada habilidade dele é um escopo: o token só ganha
// as ferramentas dos escopos que recebeu. Mapear só LÊ o banco do ERP;
// importar GRAVA no cadastro do NERP — por isso são escopos separados: um
// token pode explorar e mapear sem nunca poder escrever nada.
//
// Arquivo puro: o servidor e a tela de tokens leem as mesmas constantes.

export const CAMINHO_DO_MCP = "/api/mcp";

/**
 * O token do agente mora na tabela de terminais (`Device`), com plataforma
 * própria: tem hash, escopos, revogação e "visto por último" de graça, e a
 * autenticação Bearer (`verifyDeviceAuth`) já revalida a cada chamada se o
 * usuário continua na organização. A tela de terminais do desktop filtra esta
 * plataforma para não listar agente como caixa.
 */
export const PLATAFORMA_DO_AGENTE = "agente-ia";

export const ESCOPO_MAPEAMENTO = "mcp:mapeamento";
export const ESCOPO_IMPORTACAO = "mcp:importacao";

export const ESCOPOS_DO_MCP = [ESCOPO_MAPEAMENTO, ESCOPO_IMPORTACAO] as const;
export type EscopoDoMcp = (typeof ESCOPOS_DO_MCP)[number];

export const ROTULO_DO_ESCOPO: Record<EscopoDoMcp, string> = {
  [ESCOPO_MAPEAMENTO]: "Mapear o banco do ERP",
  [ESCOPO_IMPORTACAO]: "Importar dados para o NERP",
};
