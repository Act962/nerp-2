import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ESCOPO_IMPORTACAO, ESCOPO_MAPEAMENTO } from "../escopos";
import type { AgenteAutenticado } from "./autenticar";
import { registrarImportacao } from "./habilidades/importacao";
import { registrarMapeamento } from "./habilidades/mapeamento";

// O servidor MCP do NERP, montado a cada requisição (modo sem sessão) só com
// as habilidades que o token do agente pode exercer. Habilidade nova = um
// arquivo em `habilidades/` + um escopo em `escopos.ts` + uma linha aqui.

const INSTRUCOES = `Você está conectado ao NERP, ERP de varejo e trade marketing (pt-BR).
Este servidor ajuda a ligar o NERP ao sistema que o cliente já usa (hoje, o banco Oracle do ERP Winthor; no futuro, outros bancos).

Habilidade "mapeamento": descobrir no banco do ERP de onde vêm os dados de cada tipo do NERP (produto, estoque, categoria, cliente, preço, promoção) e gravar esse mapeamento. O mapeamento só descreve a origem — o banco do ERP é sempre lido em modo somente-leitura, nada é escrito nele.

Como trabalhar:
- Responda em português e explique as escolhas em linguagem de negócio (ex.: "PCPRODUT é o cadastro de produtos").
- Nunca invente nome de tabela ou coluna: confira com descrever_tabela antes de usar.
- Num ERP desconhecido, não presuma pelo nome: ache candidatas com buscar_colunas e confirme o conteúdo com perfilar_coluna (formatos, % preenchido, valores comuns) e amostrar_tabela.
- O nome engana: no Winthor o "código auxiliar" pode ser o EAN ou o próprio código do produto repetido; o estoque gerencial inclui reservado e bloqueado; "BLOQUEIO" é crédito, não inatividade. Use as conversões (ex.: só código de barras válido, só dígitos) e os campos certos.
- No Winthor as tabelas padrão começam com PC (PCPRODUT, PCCLIENT, PCEST, PCPEDC, PCPEDI) e as ligações quase nunca são declaradas: use ligacoes_entre_tabelas, que infere pelo nome da coluna.
- Tabela com mais de 1 milhão de linhas só pode ser lida com filtro ou janela na primeira coluna de um índice.
- Antes de salvar_mapeamento: validar, testar com um código real e pedir a confirmação do usuário.
Para um roteiro passo a passo, use o prompt "mapear_banco".`;

const INSTRUCOES_DA_IMPORTACAO = `

Habilidade "importação": subir produto, estoque e cliente do ERP para o cadastro do NERP, pelo mapeamento salvo. Esta habilidade GRAVA no NERP (o ERP continua só lido).
- Sempre simular_importacao antes, mostrar o resultado e só chamar importar com a confirmação do usuário, tipo a tipo.
- Ordem: produto → estoque → cliente. Produto e cliente vão em lotes (siga o 'proximo' até acabar); estoque vai numa chamada só.
- O ERP só preenche o que está vazio no NERP; o que o usuário já cadastrou não é sobrescrito.
Roteiro: prompt "importar_dados".`;

export function criarServidorMcp(agente: AgenteAutenticado): McpServer {
  const importa = agente.habilidades.includes(ESCOPO_IMPORTACAO);
  const servidor = new McpServer(
    { name: "nerp", title: "NERP", version: "1.0.0" },
    {
      instructions: importa
        ? INSTRUCOES + INSTRUCOES_DA_IMPORTACAO
        : INSTRUCOES,
    },
  );
  if (agente.habilidades.includes(ESCOPO_MAPEAMENTO)) {
    registrarMapeamento(servidor, agente);
  }
  if (importa) registrarImportacao(servidor, agente);
  return servidor;
}
