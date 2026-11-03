import type { Coluna, Tabela, TabelaRef } from "../domain/estrutura";
import { type Dependencias, TabelaNaoEncontrada } from "./dependencias";

export interface ColunaDescrita extends Coluna {
  rotulo: string | null;
  descricao: string | null;
}

export interface TabelaDescrita extends Omit<Tabela, "colunas"> {
  rotulo: string | null;
  descricao: string | null;
  colunas: ColunaDescrita[];
}

/** A estrutura da tabela com os nomes de negócio do ERP, quando conhecidos. */
export async function descreverTabela(
  deps: Dependencias,
  ref: TabelaRef,
): Promise<TabelaDescrita> {
  const tabela = await deps.banco.descreverTabela(ref);
  if (!tabela) throw new TabelaNaoEncontrada(ref.nome);
  const rotulo = deps.vocabulario.tabela(tabela.nome);
  return {
    ...tabela,
    rotulo: rotulo?.rotulo ?? null,
    descricao: rotulo?.descricao ?? tabela.comentario,
    colunas: tabela.colunas.map((coluna) => {
      const termo = deps.vocabulario.coluna(coluna.nome);
      return {
        ...coluna,
        rotulo: termo?.rotulo ?? null,
        descricao: termo?.descricao ?? coluna.comentario,
      };
    }),
  };
}
