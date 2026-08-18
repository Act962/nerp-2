// Allowlist de SQL para conexões de ERP.
//
// Lógica pura, separada do cliente Oracle de propósito: é a trava de segurança
// do módulo e precisa ser verificável isoladamente, sem abrir conexão.
//
// Regra do projeto: a conexão com o ERP do cliente é somente-leitura. Nenhum
// INSERT/UPDATE/DELETE/DDL sai daqui, nem como teste de privilégio.

// Comentários e literais saem antes da análise. Sem isso, `-- SELECT\nDELETE`
// passaria pelo verbo e um `SELECT 'a; b' FROM x` seria recusado à toa.
function stripLiteralsAndComments(sql: string): string {
  return sql
    .replace(/'(?:[^']|'')*'/g, "''") // literais (com escape '' preservado)
    .replace(/--[^\n]*/g, " ") // comentário de linha
    .replace(/\/\*[\s\S]*?\*\//g, " "); // comentário de bloco
}

const READ_ONLY_STATEMENT = /^\s*(?:SELECT|WITH)\b/i;

// `;` no fim é tolerado, mas nada depois dele: barra emendar um segundo
// comando na mesma string.
const STATEMENT_SEPARATOR = /;\s*\S/;

export class ReadOnlyViolationError extends Error {
  constructor(sql: string) {
    super(
      `Bloqueado: a conexão com o ERP é somente-leitura e aceita apenas SELECT/WITH. SQL recebido: ${sql.slice(0, 120)}`,
    );
    this.name = "ReadOnlyViolationError";
  }
}

export function isReadOnlySql(sql: string): boolean {
  // Literal q'[...]' não é tratado no strip; se aparecer com `;` dentro, a
  // query é recusada. Falha fechada é o comportamento certo aqui.
  const normalized = stripLiteralsAndComments(sql);
  return (
    READ_ONLY_STATEMENT.test(normalized) &&
    !STATEMENT_SEPARATOR.test(normalized)
  );
}

export function assertReadOnlySql(sql: string): void {
  if (!isReadOnlySql(sql)) {
    throw new ReadOnlyViolationError(sql);
  }
}
