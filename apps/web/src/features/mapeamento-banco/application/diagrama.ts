import { type Ligacao, ligacoesDoSchema } from "../domain/diagrama";
import {
  type Coluna,
  type Tabela,
  type TipoDeObjeto,
  chaveDaTabela,
} from "../domain/estrutura";
import type { Dependencias } from "./dependencias";

export interface ColunaDoDiagrama {
  nome: string;
  tipo: string;
  chavePrimaria: boolean;
  aceitaNulo: boolean;
  unica: boolean;
  indiceLider: boolean;
}

export interface TabelaDoDiagrama {
  id: string;
  schema: string;
  nome: string;
  rotulo: string | null;
  tipo: TipoDeObjeto;
  linhas: number | null;
  colunas: ColunaDoDiagrama[];
}

export interface Diagrama {
  schema: string;
  schemas: { nome: string; tabelas: number }[];
  tabelas: TabelaDoDiagrama[];
  ligacoes: Ligacao[];
}

function tipoCurto(coluna: Coluna): string {
  const tipo = coluna.tipoNativo.toLowerCase();
  if (coluna.tipo === "numero" && coluna.precisao !== null) {
    return coluna.escala
      ? `${tipo}(${coluna.precisao},${coluna.escala})`
      : `${tipo}(${coluna.precisao})`;
  }
  if (coluna.tipo === "texto" && coluna.tamanho !== null) {
    return `${tipo}(${coluna.tamanho})`;
  }
  return tipo;
}

/** Coluna que sozinha já identifica a linha: chave de uma coluna ou índice único. */
function colunasUnicas(tabela: Tabela): Set<string> {
  const unicas = new Set<string>();
  if (tabela.chavePrimaria.length === 1) unicas.add(tabela.chavePrimaria[0]);
  for (const indice of tabela.indices) {
    if (indice.unico && indice.colunas.length === 1) {
      unicas.add(indice.colunas[0]);
    }
  }
  return unicas;
}

/**
 * Um schema inteiro desenhável: as tabelas com as colunas resumidas e as
 * ligações (declaradas e inferidas pelo nome).
 */
export async function diagramaDoSchema(
  deps: Dependencias,
  schemaPedido: string | null,
): Promise<Diagrama> {
  const lista = await deps.banco.listarTabelas();
  const contagem = new Map<string, number>();
  for (const tabela of lista) {
    contagem.set(tabela.schema, (contagem.get(tabela.schema) ?? 0) + 1);
  }
  const principal = deps.banco.descricao.schemaPrincipal;
  const schema =
    schemaPedido && contagem.has(schemaPedido) ? schemaPedido : principal;

  const tabelas = await deps.banco.descreverSchema(schema);

  return {
    schema,
    // O principal primeiro: é onde mora o cadastro do ERP.
    schemas: [...contagem.entries()]
      .map(([nome, total]) => ({ nome, tabelas: total }))
      .sort((a, b) =>
        a.nome === principal
          ? -1
          : b.nome === principal
            ? 1
            : a.nome.localeCompare(b.nome),
      ),
    tabelas: tabelas.map((tabela) => {
      const unicas = colunasUnicas(tabela);
      return {
        id: chaveDaTabela(tabela),
        schema: tabela.schema,
        nome: tabela.nome,
        rotulo: deps.vocabulario.tabela(tabela.nome)?.rotulo ?? null,
        tipo: tabela.tipo,
        linhas: tabela.linhas,
        colunas: tabela.colunas.map((coluna) => ({
          nome: coluna.nome,
          tipo: tipoCurto(coluna),
          chavePrimaria: coluna.chavePrimaria,
          aceitaNulo: coluna.aceitaNulo,
          unica: unicas.has(coluna.nome),
          indiceLider: coluna.indiceLider,
        })),
      };
    }),
    ligacoes: ligacoesDoSchema(tabelas),
  };
}
