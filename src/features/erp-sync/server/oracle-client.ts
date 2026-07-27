import "server-only";
import oracledb from "oracledb";
import { assertReadOnlySql } from "./read-only-sql";

// Cliente Oracle SOMENTE-LEITURA.
//
// A credencial do cliente hoje é SELECT-only nas tabelas de negócio, mas grant
// muda sem avisar e não é o nosso lado que controla. As três travas abaixo
// existem para que uma escrita seja impossível a partir deste código, mesmo que
// o banco passe a permitir:
//
//   1. `SET TRANSACTION READ ONLY` na abertura — qualquer DML falha com ORA-01456.
//   2. Allowlist: só SELECT/WITH passam pelo `query()`.
//   3. A interface do conector não expõe verbo de escrita.
//
// Regra do projeto: nunca emitir INSERT/UPDATE/DELETE/DDL contra o ERP, nem
// como teste de privilégio. Auditoria de permissão se faz pelo dicionário.

export interface OracleConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  serviceName: string;
  /** Schema dono das tabelas. Específico do cliente — nunca hardcode. */
  schema: string;
}

const CALL_TIMEOUT_MS = 180_000;

/** Só os tipos que as queries de leitura precisam ligar. */
export type OracleBinds = Record<string, string | number | Date | null>;

export type OracleQuery = <T>(sql: string, binds?: OracleBinds) => Promise<T[]>;

/**
 * Abre uma sessão read-only, entrega um executor de query e fecha ao final.
 *
 * A transação read-only também dá snapshot consistente entre as queries do
 * mesmo sync. Em execução muito longa isso pode render ORA-01555 (snapshot too
 * old) — se acontecer, quebrar o sync em chamadas menores em vez de afrouxar.
 */
export async function withOracleReadOnly<T>(
  config: OracleConfig,
  run: (query: OracleQuery) => Promise<T>,
): Promise<T> {
  const connection = await oracledb.getConnection({
    user: config.user,
    password: config.password,
    connectString: `${config.host}:${config.port}/${config.serviceName}`,
  });
  connection.callTimeout = CALL_TIMEOUT_MS;

  try {
    // Fora do `query()` de propósito: o allowlist recusaria este comando, que é
    // justamente o que instala a proteção.
    await connection.execute("SET TRANSACTION READ ONLY");

    const query: OracleQuery = async <R>(
      sql: string,
      binds: OracleBinds = {},
    ) => {
      assertReadOnlySql(sql);
      const result = await connection.execute(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return (result.rows ?? []) as R[];
    };

    return await run(query);
  } finally {
    // Encerra a transação read-only sem gravar nada.
    await connection.rollback().catch(() => {});
    await connection.close().catch(() => {});
  }
}

// Timeout curto para o "Testar conexão": o usuário está esperando na tela, e o
// erro rápido (host errado, senha errada) vale mais que travar 3 minutos.
const PING_TIMEOUT_MS = 15_000;

/**
 * Abre uma conexão só para validar credenciais — sem tocar em tabela de negócio.
 * Lança o erro do Oracle (mensagem útil: ORA-01017 senha, ORA-12154 host, etc.)
 * para a UI mostrar. Usa timeout curto porque é interativo.
 */
export async function pingOracle(config: OracleConfig): Promise<void> {
  const connection = await oracledb.getConnection({
    user: config.user,
    password: config.password,
    connectString: `${config.host}:${config.port}/${config.serviceName}`,
  });
  connection.callTimeout = PING_TIMEOUT_MS;
  try {
    await connection.execute("SELECT 1 FROM dual");
  } finally {
    await connection.close().catch(() => {});
  }
}
