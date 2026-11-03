import { amostraDaTabela } from "./amostra";
import { atualizarEstrutura } from "./atualizar-estrutura";
import { conexaoDoBanco } from "./conexao";
import { descreverTabelaDoBanco } from "./descrever";
import { diagramaDoBanco } from "./diagrama";
import {
  lerMapeamento,
  salvarMapeamentoDoTipo,
  sugerirMapeamentoDoTipo,
  testarMapeamentoDoTipo,
} from "./mapeamento";
import { perfilDaColuna } from "./perfil";
import { tabelasDoBanco } from "./tabelas";

export const mapeamentoBancoRoutes = {
  conexao: conexaoDoBanco,
  tabelas: tabelasDoBanco,
  descrever: descreverTabelaDoBanco,
  diagrama: diagramaDoBanco,
  amostra: amostraDaTabela,
  perfilDaColuna,
  atualizarEstrutura,
  mapeamento: {
    ler: lerMapeamento,
    sugerir: sugerirMapeamentoDoTipo,
    testar: testarMapeamentoDoTipo,
    salvar: salvarMapeamentoDoTipo,
  },
};
