import type { ValorCru } from "../domain/converter";
import {
  type TabelaRef,
  type TipoDeDado,
  acharColuna,
} from "../domain/estrutura";
import type { ColunaEncontrada } from "../ports/banco";
import {
  type Dependencias,
  LeituraRecusada,
  TabelaNaoEncontrada,
} from "./dependencias";

// Perfil de uma coluna: o que um humano descobre olhando mil linhas — quanto
// vem preenchido, quantos valores diferentes, os mais comuns, o formato.
// É o que permite entender um ERP que ninguém conhece, sem manual.

/** Até aqui a tabela é lida inteira; acima, por amostra de blocos. */
export const LINHAS_SEM_AMOSTRA = 300_000;
const MAIS_COMUNS = 15;

export interface PerfilDaColuna {
  tabela: TabelaRef;
  coluna: string;
  rotulo: string | null;
  tipoNativo: string;
  tipo: TipoDeDado;
  amostra: {
    completa: boolean;
    percentualDeBlocos: number | null;
    linhasDaTabela: number | null;
  };
  linhasAnalisadas: number;
  preenchidas: number;
  percentualPreenchido: number;
  distintos: number;
  /** Quase todo valor é único (código, documento, telefone, nome). */
  pareceIdentificador: boolean;
  minimo: ValorCru;
  maximo: ValorCru;
  tamanho: { minimo: number; maximo: number } | null;
  /** null quando a coluna parece identificador: listar não diz nada e expõe dado. */
  maisComuns: { valor: ValorCru; quantidade: number }[] | null;
  formatos: { formato: string; quantidade: number }[];
  tempoMs: number;
}

export function percentualDeBlocos(linhas: number | null): number | null {
  if (linhas === null || linhas <= LINHAS_SEM_AMOSTRA) return null;
  const alvo = (LINHAS_SEM_AMOSTRA / linhas) * 100;
  return Math.min(50, Math.max(0.01, Number(alvo.toFixed(4))));
}

export function pareceIdentificador(preenchidas: number, distintos: number) {
  return preenchidas >= 20 && distintos >= preenchidas * 0.9;
}

export async function perfilarColuna(
  deps: Dependencias,
  pedido: { tabela: TabelaRef; coluna: string },
): Promise<PerfilDaColuna> {
  const tabela = await deps.banco.descreverTabela(pedido.tabela);
  if (!tabela) throw new TabelaNaoEncontrada(pedido.tabela.nome);
  // View não tem estatística de linhas nem aceita amostra de blocos: perfilar
  // uma view grande seria varrê-la inteira.
  if (tabela.tipo === "view") {
    throw new LeituraRecusada(
      `${tabela.nome} é uma view: o perfil só roda em tabela. Use a amostra de linhas.`,
    );
  }
  const coluna = acharColuna(tabela, pedido.coluna.trim().toUpperCase());
  if (!coluna) {
    throw new LeituraRecusada(
      `A coluna ${pedido.coluna} não existe em ${tabela.nome}.`,
    );
  }
  if (coluna.tipo === "outro") {
    throw new LeituraRecusada(`${coluna.nome} é binária e não tem perfil.`);
  }

  const percentual = percentualDeBlocos(tabela.linhas);
  const bruto = await deps.banco.perfilarColuna({
    tabela,
    coluna: coluna.nome,
    percentualDeBlocos: percentual,
    maisComuns: MAIS_COMUNS,
    comFormatos: true,
  });
  const identificador = pareceIdentificador(bruto.preenchidas, bruto.distintos);

  return {
    tabela: { schema: tabela.schema, nome: tabela.nome },
    coluna: coluna.nome,
    rotulo: deps.vocabulario.coluna(coluna.nome)?.rotulo ?? null,
    tipoNativo: coluna.tipoNativo,
    tipo: coluna.tipo,
    amostra: {
      completa: percentual === null,
      percentualDeBlocos: percentual,
      linhasDaTabela: tabela.linhas,
    },
    linhasAnalisadas: bruto.linhasAnalisadas,
    preenchidas: bruto.preenchidas,
    percentualPreenchido:
      bruto.linhasAnalisadas > 0
        ? Math.round((bruto.preenchidas / bruto.linhasAnalisadas) * 1000) / 10
        : 0,
    distintos: bruto.distintos,
    pareceIdentificador: identificador,
    minimo: bruto.minimo,
    maximo: bruto.maximo,
    tamanho:
      bruto.tamanhoMinimo !== null && bruto.tamanhoMaximo !== null
        ? { minimo: bruto.tamanhoMinimo, maximo: bruto.tamanhoMaximo }
        : null,
    maisComuns: identificador ? null : bruto.maisComuns,
    formatos: bruto.formatos,
    tempoMs: bruto.tempoMs,
  };
}

export interface ColunaEncontradaComRotulo extends ColunaEncontrada {
  rotuloDaTabela: string | null;
  rotulo: string | null;
}

/** Colunas pelo nome em todo o banco ("CNPJ", "EAN", "PRECO"). */
export async function buscarColunas(
  deps: Dependencias,
  termo: string,
  limite = 100,
): Promise<ColunaEncontradaComRotulo[]> {
  const limpo = termo.trim();
  if (limpo.length < 2) {
    throw new LeituraRecusada("Busque com pelo menos 2 letras.");
  }
  const encontradas = await deps.banco.buscarColunas(
    limpo,
    Math.min(Math.max(limite, 1), 300),
  );
  return encontradas.map((encontrada) => ({
    ...encontrada,
    rotuloDaTabela:
      deps.vocabulario.tabela(encontrada.tabela.nome)?.rotulo ?? null,
    rotulo: deps.vocabulario.coluna(encontrada.coluna)?.rotulo ?? null,
  }));
}
