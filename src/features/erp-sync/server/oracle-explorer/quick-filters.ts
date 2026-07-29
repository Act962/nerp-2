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
  PCCLIENT: [VENDEDOR],
  PCUSUARI: [SUPERVISOR],
  PCMETA: [VENDEDOR, SUPERVISOR],
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
