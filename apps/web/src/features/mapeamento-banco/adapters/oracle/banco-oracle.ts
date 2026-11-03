import "server-only";
import {
  type OracleConfig,
  pingOracle,
  withOracleReadOnly,
} from "@/features/erp-sync/server/oracle-client";
import type { ValorCru } from "../../domain/converter";
import type { BancoDeDadosPort } from "../../ports/banco";
import {
  buscarColunasNoOracle,
  descreverSchemaDoOracle,
  descreverTabelaDoOracle,
  esquecerCatalogo,
  listarTabelasDoOracle,
} from "./catalogo";
import { explicarFalhaDoOracle } from "./erros";
import {
  sqlAmostra,
  sqlLeituraMapeada,
  sqlPerfilDaColuna,
  valorCru,
} from "./sql";

// Adaptador Oracle da porta de banco. Toda leitura passa pela sessão
// somente-leitura do `oracle-client` (SET TRANSACTION READ ONLY + allowlist de
// SELECT): este arquivo não tem como escrever no ERP, nem por engano.

/** Interativo: quem espera é uma pessoa na tela, não o sync da madrugada. */
const PRAZO_DA_LEITURA_MS = 20_000;
/** Três agregações (com amostra de blocos em tabela grande). */
const PRAZO_DO_PERFIL_MS = 45_000;

function paraLinhaCrua(
  linha: Record<string, unknown>,
): Record<string, ValorCru> {
  const saida: Record<string, ValorCru> = {};
  for (const [chave, valor] of Object.entries(linha)) {
    saida[chave] = valorCru(valor);
  }
  return saida;
}

export function criarBancoOracle(
  organizationId: string,
  config: OracleConfig,
): BancoDeDadosPort {
  return {
    descricao: {
      motor: "oracle",
      rotuloDoMotor: "Oracle",
      schemaPrincipal: config.schema,
      servidor: `${config.host}:${config.port}/${config.serviceName}`,
    },

    testarConexao: () => pingOracle(config),

    listarTabelas: () => listarTabelasDoOracle(organizationId, config),

    descreverTabela: (ref) =>
      descreverTabelaDoOracle(organizationId, config, ref),

    descreverSchema: (schema) =>
      descreverSchemaDoOracle(organizationId, config, schema),

    async amostrar(pedido) {
      const { sql, binds } = sqlAmostra(pedido);
      const inicio = Date.now();
      const linhas = await withOracleReadOnly(
        config,
        (_query, sessao) =>
          sessao.queryCapped<Record<string, unknown>>(
            sql,
            pedido.porPagina + 1,
            binds,
          ),
        { callTimeoutMs: PRAZO_DA_LEITURA_MS },
      );
      return {
        colunas: pedido.colunas,
        linhas: linhas.slice(0, pedido.porPagina).map(paraLinhaCrua),
        temMais: linhas.length > pedido.porPagina,
        tempoMs: Date.now() - inicio,
      };
    },

    async lerMapeado(pedido) {
      const { sql, binds } = sqlLeituraMapeada(pedido);
      const linhas = await withOracleReadOnly(
        config,
        (_query, sessao) =>
          sessao.queryCapped<Record<string, unknown>>(
            sql,
            pedido.limite,
            binds,
          ),
        { callTimeoutMs: PRAZO_DA_LEITURA_MS },
      );
      return linhas.map(paraLinhaCrua);
    },

    async perfilarColuna(pedido) {
      const consultas = sqlPerfilDaColuna(pedido);
      const inicio = Date.now();
      const { estatisticas, maisComuns, formatos } = await withOracleReadOnly(
        config,
        async (query) => {
          const [estatisticas] = await query<Record<string, unknown>>(
            consultas.estatisticas.sql,
            consultas.estatisticas.binds,
          );
          const maisComuns = await query<{
            VALOR: unknown;
            QUANTIDADE: number;
          }>(consultas.maisComuns.sql, consultas.maisComuns.binds);
          const formatos = consultas.formatos
            ? await query<{ FORMATO: string | null; QUANTIDADE: number }>(
                consultas.formatos.sql,
                consultas.formatos.binds,
              )
            : [];
          return { estatisticas, maisComuns, formatos };
        },
        { callTimeoutMs: PRAZO_DO_PERFIL_MS },
      );
      const numero = (valor: unknown) =>
        valor === null || valor === undefined ? null : Number(valor);
      return {
        linhasAnalisadas: numero(estatisticas?.TOTAL) ?? 0,
        preenchidas: numero(estatisticas?.PREENCHIDAS) ?? 0,
        distintos: numero(estatisticas?.DISTINTOS) ?? 0,
        minimo: valorCru(estatisticas?.MINIMO),
        maximo: valorCru(estatisticas?.MAXIMO),
        tamanhoMinimo: numero(estatisticas?.TAMANHO_MIN),
        tamanhoMaximo: numero(estatisticas?.TAMANHO_MAX),
        maisComuns: maisComuns.map((linha) => ({
          valor: valorCru(linha.VALOR),
          quantidade: Number(linha.QUANTIDADE),
        })),
        formatos: formatos.map((linha) => ({
          formato: linha.FORMATO ?? "",
          quantidade: Number(linha.QUANTIDADE),
        })),
        tempoMs: Date.now() - inicio,
      };
    },

    buscarColunas: (termo, limite) =>
      buscarColunasNoOracle(organizationId, config, termo, limite),

    esquecerEstrutura: () => esquecerCatalogo(organizationId),

    explicarFalha: explicarFalhaDoOracle,
  };
}
