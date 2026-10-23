import { TIPOS_DO_NERP, type TipoDoNerp } from "../domain/alvos";
import {
  type ResumoDaTabela,
  type TabelaRef,
  chaveDaTabela,
} from "../domain/estrutura";
import type { Mapeamento } from "../domain/mapeamento";
import { origemDoPerfil } from "../domain/perfis";
import type { DescricaoDaConexao } from "../ports/banco";
import type { Dependencias } from "./dependencias";

export interface TabelaDaLista extends ResumoDaTabela {
  rotulo: string | null;
  descricao: string | null;
  /** Tipos do NERP que leem desta tabela (como principal ou junção). */
  mapeadaComo: TipoDoNerp[];
}

export interface Exploracao {
  conexao: DescricaoDaConexao;
  erp: string;
  tabelas: TabelaDaLista[];
}

/**
 * Quais tabelas cada tipo usa, sem descrever nenhuma: para o automático vale o
 * primeiro perfil cujas tabelas existem. É só o selo "mapeada" da lista — a
 * validação completa fica no modo Mapear.
 */
function tabelasPorTipo(
  deps: Dependencias,
  mapeamento: Mapeamento,
  tabelas: ResumoDaTabela[],
): Map<string, TipoDoNerp[]> {
  const usos = new Map<string, TipoDoNerp[]>();
  const marcar = (ref: TabelaRef, tipo: TipoDoNerp) => {
    const chave = chaveDaTabela(ref);
    usos.set(chave, [...(usos.get(chave) ?? []), tipo]);
  };

  for (const tipo of TIPOS_DO_NERP) {
    const config = mapeamento.tipos[tipo];
    if (config.modo === "desligado") continue;
    let origem = config.modo === "manual" ? config.origem : undefined;
    if (!origem) {
      for (const perfil of deps.vocabulario.perfis(tipo)) {
        const montada = origemDoPerfil(
          perfil,
          tabelas,
          deps.banco.descricao.schemaPrincipal,
        );
        if (montada.ok) {
          origem = montada.origem;
          break;
        }
      }
    }
    if (!origem) continue;
    marcar(origem.tabela, tipo);
    if (origem.juncao) marcar(origem.juncao.tabela, tipo);
  }
  return usos;
}

export async function explorarBanco(deps: Dependencias): Promise<Exploracao> {
  const [tabelas, mapeamento] = await Promise.all([
    deps.banco.listarTabelas(),
    deps.repositorio.carregar(),
  ]);
  const usos = tabelasPorTipo(deps, mapeamento, tabelas);

  return {
    conexao: deps.banco.descricao,
    erp: deps.vocabulario.nome,
    tabelas: tabelas.map((tabela) => {
      const rotulo = deps.vocabulario.tabela(tabela.nome);
      return {
        ...tabela,
        rotulo: rotulo?.rotulo ?? null,
        descricao: rotulo?.descricao ?? tabela.comentario,
        mapeadaComo: usos.get(chaveDaTabela(tabela)) ?? [],
      };
    }),
  };
}
