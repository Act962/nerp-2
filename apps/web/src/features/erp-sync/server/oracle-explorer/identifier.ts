// Oracle não aceita bind variable em identificador (schema/tabela/coluna), só
// em valor. Então identificador é sempre interpolado — e validar antes é o que
// impede injeção por configuração.
//
// Cópia deliberada da regra que já existe em connectors/winthor.ts: aquele
// arquivo é o conector de negócio e não deve virar dependência do explorador
// de consultas. Se a regra mudar, mudam os dois.
const ORACLE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_$#]{0,29}$/;

export class InvalidIdentifierError extends Error {
  constructor(value: string) {
    super(`Identificador Oracle inválido: ${value.slice(0, 40)}`);
    this.name = "InvalidIdentifierError";
  }
}

export function assertIdentifier(value: string): string {
  if (!ORACLE_IDENTIFIER.test(value)) {
    throw new InvalidIdentifierError(value);
  }
  return value;
}

export function isIdentifier(value: string): boolean {
  return ORACLE_IDENTIFIER.test(value);
}
