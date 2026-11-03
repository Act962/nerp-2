import { type Tabela, chaveDaTabela } from "./estrutura";

// Ligações entre tabelas para o diagrama.
//
// ERP antigo quase não declara chave estrangeira: no Winthor do Armazém são 2
// no schema principal, para 15 chaves primárias. Só o declarado deixaria o
// diagrama vazio. Por isso há também a ligação INFERIDA pelo nome: uma coluna
// que tem o mesmo nome da chave primária (de uma coluna só) de outra tabela —
// PCPEDI.CODPROD → PCPRODUT, PCPEDC.CODCLI → PCCLIENT. É convenção, não
// garantia: a tela mostra as duas com traços diferentes e deixa desligar.

export type OrigemDaLigacao = "declarada" | "inferida";

export interface Ligacao {
  id: string;
  /** Tabela que aponta (a que tem a coluna "estrangeira"). */
  de: string;
  colunasDe: string[];
  /** Tabela apontada (a dona da chave). */
  para: string;
  colunasPara: string[];
  origem: OrigemDaLigacao;
}

/**
 * Nomes que são chave primária de tabela demais para dizer alguma coisa: uma
 * coluna CODIGO numa tabela qualquer não aponta para PCFILIAL só porque a chave
 * de PCFILIAL também se chama CODIGO.
 */
const NOMES_GENERICOS = new Set([
  "ID",
  "CODIGO",
  "COD",
  "SEQ",
  "SEQUENCIA",
  "NUMSEQ",
  "NUMERO",
  "RECNUM",
  "ROWID",
]);

export function ligacoesDoSchema(tabelas: Tabela[]): Ligacao[] {
  const ligacoes: Ligacao[] = [];
  const chaves = new Set<string>();

  for (const tabela of tabelas) {
    const de = chaveDaTabela(tabela);
    for (const relacao of tabela.relacoes) {
      const para = chaveDaTabela(relacao.referencia);
      const id = `d:${de}:${relacao.nome}`;
      ligacoes.push({
        id,
        de,
        colunasDe: relacao.colunas,
        para,
        colunasPara: relacao.colunasReferenciadas,
        origem: "declarada",
      });
      for (const coluna of relacao.colunas) chaves.add(`${de}.${coluna}`);
    }
  }

  // Coluna → tabelas cuja chave primária é exatamente essa coluna.
  const donos = new Map<string, Tabela[]>();
  for (const tabela of tabelas) {
    if (tabela.chavePrimaria.length !== 1) continue;
    const [coluna] = tabela.chavePrimaria;
    if (NOMES_GENERICOS.has(coluna)) continue;
    donos.set(coluna, [...(donos.get(coluna) ?? []), tabela]);
  }

  for (const tabela of tabelas) {
    const de = chaveDaTabela(tabela);
    // Coluna que já é a chave inteira desta tabela não aponta para fora: duas
    // tabelas com a mesma chave de uma coluna (1:1) virariam ligação nos dois
    // sentidos, sem dizer qual estende qual.
    const chaveInteira =
      tabela.chavePrimaria.length === 1 ? tabela.chavePrimaria[0] : null;
    for (const coluna of tabela.colunas) {
      if (coluna.nome === chaveInteira) continue;
      const candidatos = (donos.get(coluna.nome) ?? []).filter(
        (dono) => chaveDaTabela(dono) !== de,
      );
      // Mais de um dono possível = ambíguo; melhor não desenhar do que errar.
      if (candidatos.length !== 1) continue;
      if (chaves.has(`${de}.${coluna.nome}`)) continue;
      const [dono] = candidatos;
      ligacoes.push({
        id: `i:${de}.${coluna.nome}`,
        de,
        colunasDe: [coluna.nome],
        para: chaveDaTabela(dono),
        colunasPara: [coluna.nome],
        origem: "inferida",
      });
    }
  }

  return ligacoes;
}
