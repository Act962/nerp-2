import type { Coluna, ResumoDaTabela, Tabela, TipoDeDado } from "./estrutura";

// Tabelas falsas para os testes do domínio e dos casos de uso — o formato do
// Winthor do Armazém, sem banco.

export function coluna(
  nome: string,
  tipo: TipoDeDado,
  extra: Partial<Coluna> = {},
): Coluna {
  const nativo: Record<TipoDeDado, string> = {
    texto: "VARCHAR2",
    numero: "NUMBER",
    data: "DATE",
    outro: "BLOB",
  };
  return {
    nome,
    tipoNativo: nativo[tipo],
    tipo,
    tamanho: null,
    precisao: null,
    escala: null,
    aceitaNulo: true,
    comentario: null,
    chavePrimaria: false,
    indexada: false,
    indiceLider: false,
    ...extra,
  };
}

export function tabela(
  nome: string,
  linhas: number | null,
  colunas: Coluna[],
  schema = "LGCARVALHO",
): Tabela {
  return {
    schema,
    nome,
    tipo: "tabela",
    linhas,
    comentario: null,
    colunas,
    chavePrimaria: colunas.filter((c) => c.chavePrimaria).map((c) => c.nome),
    indices: [],
    relacoes: [],
    referenciadaPor: [],
  };
}

export const PCPRODUT = tabela("PCPRODUT", 24_092, [
  coluna("CODPROD", "numero", {
    chavePrimaria: true,
    indexada: true,
    indiceLider: true,
  }),
  coluna("DESCRICAO", "texto"),
  coluna("CODAUXILIAR", "numero"),
  coluna("UNIDADE", "texto"),
  coluna("DTEXCLUSAO", "data"),
  coluna("QTUNITCX", "numero"),
  coluna("CODSEC", "numero"),
]);

export const PCPEDI = tabela("PCPEDI", 16_993_357, [
  coluna("NUMPED", "numero", { indexada: true, indiceLider: true }),
  coluna("CODPROD", "numero", { indexada: true }),
  coluna("DATA", "data", { indexada: true, indiceLider: true }),
  coluna("PTABELA", "numero"),
  coluna("POSICAO", "texto"),
]);

export const PCPEDC = tabela("PCPEDC", 2_395_511, [
  coluna("NUMPED", "numero", {
    chavePrimaria: true,
    indexada: true,
    indiceLider: true,
  }),
  coluna("NUMREGIAO", "numero"),
  coluna("DATA", "data", { indexada: true, indiceLider: true }),
]);

export function resumo(t: Tabela): ResumoDaTabela {
  return {
    schema: t.schema,
    nome: t.nome,
    tipo: t.tipo,
    linhas: t.linhas,
    comentario: t.comentario,
  };
}
