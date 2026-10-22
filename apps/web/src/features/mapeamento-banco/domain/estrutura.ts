// Estrutura do banco do ERP do cliente, em termos que não dependem do motor.
//
// O adaptador (Oracle hoje) traduz o catálogo do banco para estes tipos; o
// resto da feature — validação, tela, perfis — só conhece isto. Por isso nada
// aqui fala em ALL_TABLES, VARCHAR2 ou ORA-xxxxx.

export type TipoDeObjeto = "tabela" | "view";

/** O tipo da coluna reduzido ao que importa para mapear. */
export type TipoDeDado = "texto" | "numero" | "data" | "outro";

/** Tabela sempre identificada pelo dono: o mesmo nome pode existir em dois
 * schemas (no Winthor, o WMS mora em SWMS e não no schema principal). */
export interface TabelaRef {
  schema: string;
  nome: string;
}

export interface ResumoDaTabela extends TabelaRef {
  tipo: TipoDeObjeto;
  /** Estatística do banco, não contagem exata — pode estar velha ou vazia. */
  linhas: number | null;
  comentario: string | null;
}

export interface Coluna {
  nome: string;
  /** Tipo como o banco escreve (VARCHAR2, NUMBER…), para quem conhece o ERP. */
  tipoNativo: string;
  tipo: TipoDeDado;
  tamanho: number | null;
  precisao: number | null;
  escala: number | null;
  aceitaNulo: boolean;
  comentario: string | null;
  chavePrimaria: boolean;
  /** Aparece em algum índice, em qualquer posição. */
  indexada: boolean;
  /** É a primeira coluna de algum índice — o que de fato evita varrer a tabela. */
  indiceLider: boolean;
}

export interface Indice {
  nome: string;
  unico: boolean;
  colunas: string[];
}

export interface Relacao {
  nome: string;
  colunas: string[];
  referencia: TabelaRef;
  colunasReferenciadas: string[];
}

export interface Tabela extends ResumoDaTabela {
  colunas: Coluna[];
  chavePrimaria: string[];
  indices: Indice[];
  /** Chaves estrangeiras DESTA tabela apontando para outras. */
  relacoes: Relacao[];
  /** Chaves estrangeiras de outras tabelas apontando para esta. */
  referenciadaPor: Relacao[];
}

/**
 * Acima disso, ler sem filtro por índice vira varredura de minutos no ERP do
 * cliente, em horário comercial. Mesmo corte do pré-voo do dashboard
 * (`oracle-explorer/preflight.ts`), para as duas telas não discordarem.
 */
export const TABELA_GRANDE = 1_000_000;

export function chaveDaTabela(ref: TabelaRef): string {
  return `${ref.schema}.${ref.nome}`;
}

export function mesmaTabela(a: TabelaRef, b: TabelaRef): boolean {
  return a.schema === b.schema && a.nome === b.nome;
}

export function ehTabelaGrande(tabela: { linhas: number | null }): boolean {
  return (tabela.linhas ?? 0) >= TABELA_GRANDE;
}

export function acharColuna(
  tabela: Pick<Tabela, "colunas">,
  nome: string,
): Coluna | null {
  return tabela.colunas.find((coluna) => coluna.nome === nome) ?? null;
}

export type Liberacao = { ok: true } | { ok: false; motivo: string };

/**
 * Filtrar ou ordenar por esta coluna é seguro? Em tabela pequena, sempre. Em
 * tabela grande, só pela primeira coluna de um índice — qualquer outra obriga o
 * banco a ler a tabela inteira.
 */
export function podeFiltrarOuOrdenarPor(
  tabela: Pick<Tabela, "colunas" | "linhas" | "nome">,
  nomeDaColuna: string,
): Liberacao {
  const coluna = acharColuna(tabela, nomeDaColuna);
  if (!coluna) {
    return {
      ok: false,
      motivo: `A coluna ${nomeDaColuna} não existe em ${tabela.nome}.`,
    };
  }
  if (!ehTabelaGrande(tabela) || coluna.indiceLider) return { ok: true };
  return {
    ok: false,
    motivo: `${tabela.nome} tem ${formatarLinhas(tabela.linhas)} linhas e ${coluna.nome} não abre nenhum índice: o banco leria a tabela inteira. Use uma coluna com índice.`,
  };
}

export function formatarLinhas(linhas: number | null): string {
  if (linhas === null) return "um número desconhecido de";
  return linhas.toLocaleString("pt-BR");
}
