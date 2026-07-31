import "server-only";

// Atalhos de filtro curados por tabela. Existem por dois motivos:
//
//  1. Usabilidade: o usuário escolhe "Filial = Matriz", não "CODFILIAL eq 1".
//  2. Performance: todo atalho aqui cai numa coluna CONFIRMADA como indexada
//     nas tabelas grandes (medido no dicionário: PCPEDC tem CODFILIAL/CODCLI/
//     CODUSUR/CODSUPERVISOR como coluna líder; PCPEDI e PCMOV têm CODPROD/
//     CODCLI). São exatamente os cortes que evitam varredura.
//
// Filtro em coluna fora desta lista continua possível pelo "filtro avançado",
// só que lá a UI avisa quando não há índice.

export interface QuickFilterDomain {
  /** Tabela de domínio de onde sai a lista de valores. */
  table: string;
  valueColumn: string;
  labelColumn: string;
  /** Coluna EXTRA do cadastro, exibida como coluna própria nas tabelas
   * agrupadas por esta dimensão. Existe porque "estoque = 1" é ambíguo sem
   * saber se a unidade de venda do item é dúzia, caixa ou pacote — e essa
   * informação mora no cadastro do produto, não na tabela de saldo. */
  extraColumn?: { column: string; label: string };
}

export interface QuickFilterDef {
  key: string;
  label: string;
  /** Coluna na tabela de fatos onde o filtro é aplicado. */
  column: string;
  domain: QuickFilterDomain;
}

const FILIAL: QuickFilterDef = {
  key: "filial",
  label: "Filial",
  column: "CODFILIAL",
  domain: { table: "PCFILIAL", valueColumn: "CODIGO", labelColumn: "FANTASIA" },
};

const VENDEDOR: QuickFilterDef = {
  key: "vendedor",
  label: "Vendedor",
  column: "CODUSUR",
  domain: { table: "PCUSUARI", valueColumn: "CODUSUR", labelColumn: "NOME" },
};

const SUPERVISOR: QuickFilterDef = {
  key: "supervisor",
  label: "Supervisor",
  column: "CODSUPERVISOR",
  domain: {
    table: "PCSUPERV",
    valueColumn: "CODSUPERVISOR",
    labelColumn: "NOME",
  },
};

const CLIENTE: QuickFilterDef = {
  key: "cliente",
  label: "Cliente",
  column: "CODCLI",
  domain: { table: "PCCLIENT", valueColumn: "CODCLI", labelColumn: "CLIENTE" },
};

const PRODUTO: QuickFilterDef = {
  key: "produto",
  label: "Produto",
  column: "CODPROD",
  domain: {
    table: "PCPRODUT",
    valueColumn: "CODPROD",
    labelColumn: "DESCRICAO",
    // Saldo no Winthor é contado na UNIDADE DE VENDA do item, que varia por
    // produto (DZ, CX, PC, DP…). Sem esta coluna, "estoque = 1" não diz se é
    // uma dúzia ou uma caixa.
    extraColumn: { column: "UNIDADE", label: "Unidade" },
  },
};

const MARCA: QuickFilterDef = {
  key: "marca",
  label: "Marca",
  column: "CODMARCA",
  domain: { table: "PCMARCA", valueColumn: "CODMARCA", labelColumn: "MARCA" },
};

const DEPARTAMENTO: QuickFilterDef = {
  key: "departamento",
  label: "Departamento",
  column: "CODEPTO",
  domain: {
    table: "PCDEPTO",
    valueColumn: "CODEPTO",
    labelColumn: "DESCRICAO",
  },
};

const FORNECEDOR: QuickFilterDef = {
  key: "fornecedor",
  label: "Fornecedor",
  column: "CODFORNEC",
  domain: {
    table: "PCFORNEC",
    valueColumn: "CODFORNEC",
    labelColumn: "FORNECEDOR",
  },
};

const SECAO: QuickFilterDef = {
  key: "secao",
  label: "Seção",
  column: "CODSEC",
  domain: { table: "PCSECAO", valueColumn: "CODSEC", labelColumn: "DESCRICAO" },
};

const QUICK_FILTERS_BY_TABLE: Record<string, QuickFilterDef[]> = {
  PCPEDC: [FILIAL, VENDEDOR, SUPERVISOR, CLIENTE],
  PCPEDI: [CLIENTE, PRODUTO, VENDEDOR],
  PCMOV: [FILIAL, PRODUTO, CLIENTE, FORNECEDOR],
  PCPRODUT: [MARCA, DEPARTAMENTO, SECAO, FORNECEDOR],
  // CLIENTE aqui é um self-join (PCCLIENT como fato E como domínio) — existe
  // só para o groupBy por CODCLI trazer o nome (`quickFilterForColumn`) em vez
  // do código cru; o join é barato porque CODCLI é índice líder dos dois lados.
  PCCLIENT: [VENDEDOR, CLIENTE],
  PCUSUARI: [SUPERVISOR],
  PCMETA: [VENDEDOR, SUPERVISOR],
  // Prestações (contas a receber). As quatro colunas são índice líder aqui,
  // então servem tanto de filtro quanto de agrupamento com nome — sem isso
  // "Top clientes inadimplentes" listava só o código do cliente.
  PCPREST: [FILIAL, CLIENTE, VENDEDOR, SUPERVISOR],
  // Saldo de estoque por filial/produto — as duas chaves são índice líder.
  PCEST: [FILIAL, PRODUTO],
  // WMS (schema SWMS). O tipo das chaves NÃO bate com o do cadastro —
  // CODPROD é VARCHAR2 aqui e NUMBER em PCPRODUT — mas o Oracle converte e o
  // join foi validado contra a base: todos os CODPROD são numéricos, então
  // não há risco de ORA-01722. Custa uma conversão por linha, aceitável nas
  // ~90 mil que a tabela tem.
  TBCMS0027: [FILIAL, PRODUTO],
};

const ALL_BY_KEY = new Map<string, QuickFilterDef>(
  Object.values(QUICK_FILTERS_BY_TABLE)
    .flat()
    .map((definition) => [definition.key, definition]),
);

/** Atalhos aplicáveis a uma tabela — só os que a tabela realmente tem. */
export function quickFiltersFor(
  table: string,
  hasColumn: (column: string) => boolean,
): QuickFilterDef[] {
  return (QUICK_FILTERS_BY_TABLE[table] ?? []).filter((definition) =>
    hasColumn(definition.column),
  );
}

export function quickFilterByKey(key: string): QuickFilterDef | null {
  return ALL_BY_KEY.get(key) ?? null;
}

/**
 * Atalho cujo `column` casa com a coluna dada — usado para traduzir código em
 * nome no agrupamento (senão o widget mostraria "1", "2" em vez de
 * "ARMAZEM CARVALHO").
 */
export function quickFilterForColumn(
  table: string,
  column: string,
): QuickFilterDef | null {
  return (
    (QUICK_FILTERS_BY_TABLE[table] ?? []).find(
      (definition) => definition.column === column,
    ) ?? null
  );
}
