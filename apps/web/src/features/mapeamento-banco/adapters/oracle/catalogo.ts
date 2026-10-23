import "server-only";
import {
  type OracleConfig,
  type OracleQuery,
  withOracleReadOnly,
} from "@/features/erp-sync/server/oracle-client";
import type { ColunaEncontrada } from "../../ports/banco";
import type {
  Coluna,
  Indice,
  Relacao,
  ResumoDaTabela,
  Tabela,
  TabelaRef,
} from "../../domain/estrutura";
import { chaveDaTabela } from "../../domain/estrutura";
import {
  SQL_CHAVES,
  SQL_CHAVES_DO_SCHEMA,
  SQL_COLUNAS,
  SQL_COLUNAS_DO_SCHEMA,
  SQL_INDICES_DO_SCHEMA,
  padraoDeBusca,
  sqlBuscarColunas,
  SQL_DONOS,
  SQL_INDICES,
  SQL_REFERENCIADA_POR,
  listaDeBinds,
  sqlListarTabelas,
  tipoDeDado,
} from "./sql";

// Catálogo do Oracle do cliente, carregado sob demanda: a lista de tabelas é
// uma consulta leve; colunas, chaves e índices vêm por tabela, quando alguém a
// abre. O dicionário do dashboard (`oracle-explorer/dictionary.ts`) lê todas as
// colunas de todas as tabelas de uma vez — bom para montar consulta, caro para
// navegar.
//
// Guardado por 1h por organização: estrutura de ERP quase não muda, e quando
// muda (grant novo) existe o "Atualizar estrutura".

const VALIDADE_MS = 60 * 60 * 1000;
const PRAZO_DA_LISTA_MS = 60_000;
const PRAZO_DA_DESCRICAO_MS = 30_000;

interface Guardado<T> {
  expira: number;
  valor: T;
}

const listas = new Map<string, Guardado<ResumoDaTabela[]>>();
const descricoes = new Map<string, Guardado<Tabela | null>>();
const listasEmAndamento = new Map<string, Promise<ResumoDaTabela[]>>();
const schemas = new Map<string, Guardado<Tabela[]>>();

export function esquecerCatalogo(organizationId: string): void {
  listas.delete(organizationId);
  for (const chave of descricoes.keys()) {
    if (chave.startsWith(`${organizationId}|`)) descricoes.delete(chave);
  }
  for (const chave of schemas.keys()) {
    if (chave.startsWith(`${organizationId}|`)) schemas.delete(chave);
  }
}

interface LinhaDaLista {
  DONO: string;
  NOME: string;
  TIPO: "TABELA" | "VIEW";
  LINHAS: number | null;
  COMENTARIO: string | null;
}

// O APEX antigo (APEX_030200, FLOWS_…) vem marcado como "não é do Oracle" e
// publica centenas de views de catálogo para todo mundo — no Armazém eram 111
// itens de ruído na lista, nenhum dado do ERP.
const DONOS_DE_FERRAMENTA = /^(APEX_|APEX$|FLOWS_|ORDS_)/;

async function lerDonos(
  query: OracleQuery,
  principal: string,
): Promise<string[]> {
  try {
    const linhas = await query<{ USERNAME: string }>(SQL_DONOS);
    const outros = linhas
      .map((linha) => linha.USERNAME)
      .filter((nome) => nome !== principal && !DONOS_DE_FERRAMENTA.test(nome));
    return [principal, ...outros];
  } catch {
    // Oracle antigo, sem ORACLE_MAINTAINED: fica só o schema principal.
    return [principal];
  }
}

async function buscarLista(config: OracleConfig): Promise<ResumoDaTabela[]> {
  const linhas = await withOracleReadOnly(
    config,
    async (query) => {
      const donos = await lerDonos(query, config.schema);
      const { lista, binds } = listaDeBinds(donos, "d");
      return query<LinhaDaLista>(sqlListarTabelas(lista), binds);
    },
    { callTimeoutMs: PRAZO_DA_LISTA_MS },
  );
  return (
    linhas
      // Lixeira do Oracle e tabela de ferramenta não são dado do ERP.
      .filter(
        (linha) =>
          !linha.NOME.startsWith("BIN$") && linha.NOME !== "SQLN_EXPLAIN_PLAN",
      )
      .map((linha) => ({
        schema: linha.DONO,
        nome: linha.NOME,
        tipo: linha.TIPO === "VIEW" ? ("view" as const) : ("tabela" as const),
        linhas: linha.LINHAS === null ? null : Number(linha.LINHAS),
        comentario: linha.COMENTARIO?.trim() || null,
      }))
      .sort(
        (a, b) =>
          a.schema.localeCompare(b.schema) || a.nome.localeCompare(b.nome),
      )
  );
}

export async function listarTabelasDoOracle(
  organizationId: string,
  config: OracleConfig,
): Promise<ResumoDaTabela[]> {
  const guardada = listas.get(organizationId);
  if (guardada && guardada.expira > Date.now()) return guardada.valor;

  const andamento = listasEmAndamento.get(organizationId);
  if (andamento) return andamento;

  const promessa = buscarLista(config)
    .then((tabelas) => {
      listas.set(organizationId, {
        expira: Date.now() + VALIDADE_MS,
        valor: tabelas,
      });
      return tabelas;
    })
    .finally(() => listasEmAndamento.delete(organizationId));
  listasEmAndamento.set(organizationId, promessa);
  return promessa;
}

interface LinhaDeColuna {
  NOME: string;
  TIPO: string;
  TAMANHO: number | null;
  PRECISAO: number | null;
  ESCALA: number | null;
  NULO: "Y" | "N";
  COMENTARIO: string | null;
}

interface LinhaDeChave {
  NOME: string;
  TIPO: "P" | "R";
  COLUNA: string;
  POSICAO: number;
  REF_DONO: string | null;
  REF_TABELA: string | null;
  REF_COLUNA: string | null;
}

interface LinhaDeReferencia {
  NOME: string;
  DONO: string;
  TABELA: string;
  COLUNA: string;
  REF_COLUNA: string;
}

interface LinhaDeIndice {
  NOME: string;
  UNICIDADE: string;
  COLUNA: string;
  POSICAO: number;
}

function montarRelacoes(chaves: LinhaDeChave[]): Relacao[] {
  const porNome = new Map<string, Relacao>();
  for (const chave of chaves) {
    if (chave.TIPO !== "R" || !chave.REF_DONO || !chave.REF_TABELA) continue;
    const relacao = porNome.get(chave.NOME) ?? {
      nome: chave.NOME,
      colunas: [],
      referencia: { schema: chave.REF_DONO, nome: chave.REF_TABELA },
      colunasReferenciadas: [],
    };
    relacao.colunas.push(chave.COLUNA);
    if (chave.REF_COLUNA) relacao.colunasReferenciadas.push(chave.REF_COLUNA);
    porNome.set(chave.NOME, relacao);
  }
  return [...porNome.values()];
}

function montarReferencias(linhas: LinhaDeReferencia[]): Relacao[] {
  const porNome = new Map<string, Relacao>();
  for (const linha of linhas) {
    const chave = `${linha.DONO}.${linha.NOME}`;
    const relacao = porNome.get(chave) ?? {
      nome: linha.NOME,
      colunas: [],
      referencia: { schema: linha.DONO, nome: linha.TABELA },
      colunasReferenciadas: [],
    };
    // Aqui a "referência" é a tabela de FORA que aponta para esta: `colunas`
    // são as desta tabela, `colunasReferenciadas` as da outra.
    relacao.colunas.push(linha.REF_COLUNA);
    relacao.colunasReferenciadas.push(linha.COLUNA);
    porNome.set(chave, relacao);
  }
  return [...porNome.values()];
}

function montarIndices(linhas: LinhaDeIndice[]): Indice[] {
  const porNome = new Map<string, Indice>();
  for (const linha of linhas) {
    const indice = porNome.get(linha.NOME) ?? {
      nome: linha.NOME,
      unico: linha.UNICIDADE === "UNIQUE",
      colunas: [],
    };
    indice.colunas.push(linha.COLUNA);
    porNome.set(linha.NOME, indice);
  }
  return [...porNome.values()];
}

async function buscarDescricao(
  config: OracleConfig,
  resumo: ResumoDaTabela,
): Promise<Tabela> {
  const binds = { dono: resumo.schema, tabela: resumo.nome };
  // Em sequência na mesma conexão: o driver serializaria de qualquer jeito, e
  // cada uma fica com o prazo inteiro (ver o comentário em dictionary.ts).
  const { colunas, chaves, referencias, indices } = await withOracleReadOnly(
    config,
    async (query) => {
      const colunas = await query<LinhaDeColuna>(SQL_COLUNAS, binds);
      // View não tem chave nem índice próprios.
      if (resumo.tipo === "view") {
        return { colunas, chaves: [], referencias: [], indices: [] };
      }
      const chaves = await query<LinhaDeChave>(SQL_CHAVES, binds);
      const referencias = await query<LinhaDeReferencia>(
        SQL_REFERENCIADA_POR,
        binds,
      );
      const indices = await query<LinhaDeIndice>(SQL_INDICES, binds);
      return { colunas, chaves, referencias, indices };
    },
    { callTimeoutMs: PRAZO_DA_DESCRICAO_MS },
  );

  return montarTabela(
    resumo,
    colunas,
    chaves,
    indices,
    montarReferencias(referencias),
  );
}

function montarTabela(
  resumo: ResumoDaTabela,
  colunas: LinhaDeColuna[],
  chaves: LinhaDeChave[],
  indices: LinhaDeIndice[],
  referenciadaPor: Relacao[],
): Tabela {
  const chavePrimaria = chaves
    .filter((chave) => chave.TIPO === "P")
    .map((chave) => chave.COLUNA);
  const indicesMontados = montarIndices(indices);
  const posicaoNoIndice = new Map<string, number>();
  for (const linha of indices) {
    const atual = posicaoNoIndice.get(linha.COLUNA);
    const posicao = Number(linha.POSICAO);
    if (atual === undefined || posicao < atual) {
      posicaoNoIndice.set(linha.COLUNA, posicao);
    }
  }

  const colunasMontadas: Coluna[] = colunas.map((linha) => {
    const posicao = posicaoNoIndice.get(linha.NOME);
    return {
      nome: linha.NOME,
      tipoNativo: linha.TIPO,
      tipo: tipoDeDado(linha.TIPO),
      tamanho: linha.TAMANHO === null ? null : Number(linha.TAMANHO),
      precisao: linha.PRECISAO === null ? null : Number(linha.PRECISAO),
      escala: linha.ESCALA === null ? null : Number(linha.ESCALA),
      aceitaNulo: linha.NULO === "Y",
      comentario: linha.COMENTARIO?.trim() || null,
      chavePrimaria: chavePrimaria.includes(linha.NOME),
      indexada: posicao !== undefined,
      indiceLider: posicao === 1,
    };
  });

  return {
    ...resumo,
    colunas: colunasMontadas,
    chavePrimaria,
    indices: indicesMontados,
    relacoes: montarRelacoes(chaves),
    referenciadaPor,
  };
}

/**
 * Só descreve o que está na lista: tabela que a credencial não enxerga (ou que
 * não existe) volta null, sem tentar adivinhar.
 */
export async function descreverTabelaDoOracle(
  organizationId: string,
  config: OracleConfig,
  ref: TabelaRef,
): Promise<Tabela | null> {
  const chave = `${organizationId}|${chaveDaTabela(ref)}`;
  const guardada = descricoes.get(chave);
  if (guardada && guardada.expira > Date.now()) return guardada.valor;

  const lista = await listarTabelasDoOracle(organizationId, config);
  const resumo = lista.find(
    (tabela) => tabela.schema === ref.schema && tabela.nome === ref.nome,
  );
  const tabela = resumo ? await buscarDescricao(config, resumo) : null;
  descricoes.set(chave, { expira: Date.now() + VALIDADE_MS, valor: tabela });
  return tabela;
}

const PRAZO_DO_SCHEMA_MS = 90_000;

type ComTabela<T> = T & { TABELA: string };

function agruparPorTabela<T extends { TABELA: string }>(
  linhas: T[],
): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const linha of linhas) {
    grupos.set(linha.TABELA, [...(grupos.get(linha.TABELA) ?? []), linha]);
  }
  return grupos;
}

/**
 * Todas as tabelas de um schema, de uma vez — é o que o diagrama precisa. Três
 * consultas no schema inteiro em vez de quatro por tabela: no Armazém o SWMS
 * tem 143 tabelas, e descrever uma a uma levaria minutos.
 */
export async function descreverSchemaDoOracle(
  organizationId: string,
  config: OracleConfig,
  schema: string,
): Promise<Tabela[]> {
  const chave = `${organizationId}|${schema}`;
  const guardado = schemas.get(chave);
  if (guardado && guardado.expira > Date.now()) return guardado.valor;

  const lista = await listarTabelasDoOracle(organizationId, config);
  const doSchema = lista.filter((tabela) => tabela.schema === schema);
  if (doSchema.length === 0) return [];

  const binds = { dono: schema };
  const { colunas, chaves, indices } = await withOracleReadOnly(
    config,
    async (query) => {
      const colunas = await query<ComTabela<LinhaDeColuna>>(
        SQL_COLUNAS_DO_SCHEMA,
        binds,
      );
      const chaves = await query<ComTabela<LinhaDeChave>>(
        SQL_CHAVES_DO_SCHEMA,
        binds,
      );
      const indices = await query<ComTabela<LinhaDeIndice>>(
        SQL_INDICES_DO_SCHEMA,
        binds,
      );
      return { colunas, chaves, indices };
    },
    { callTimeoutMs: PRAZO_DO_SCHEMA_MS },
  );

  const colunasPorTabela = agruparPorTabela(colunas);
  const chavesPorTabela = agruparPorTabela(chaves);
  const indicesPorTabela = agruparPorTabela(indices);

  // "Apontam para esta" sai das próprias chaves do schema, sem outra consulta.
  const referenciadaPor = new Map<string, Relacao[]>();
  for (const [tabela, linhas] of chavesPorTabela) {
    for (const relacao of montarRelacoes(linhas)) {
      if (relacao.referencia.schema !== schema) continue;
      const chaveDoAlvo = relacao.referencia.nome;
      referenciadaPor.set(chaveDoAlvo, [
        ...(referenciadaPor.get(chaveDoAlvo) ?? []),
        {
          nome: relacao.nome,
          colunas: relacao.colunasReferenciadas,
          referencia: { schema, nome: tabela },
          colunasReferenciadas: relacao.colunas,
        },
      ]);
    }
  }

  const tabelas = doSchema.map((resumo) =>
    montarTabela(
      resumo,
      colunasPorTabela.get(resumo.nome) ?? [],
      chavesPorTabela.get(resumo.nome) ?? [],
      indicesPorTabela.get(resumo.nome) ?? [],
      referenciadaPor.get(resumo.nome) ?? [],
    ),
  );
  schemas.set(chave, { expira: Date.now() + VALIDADE_MS, valor: tabelas });
  return tabelas;
}

interface LinhaDaBusca {
  DONO: string;
  TABELA: string;
  COLUNA: string;
  TIPO: string;
  COMENTARIO: string | null;
}

/**
 * Procura coluna pelo nome (ou comentário) em todos os schemas visíveis — a
 * primeira pergunta num ERP desconhecido é "onde está o CNPJ?". Só devolve
 * coluna de tabela/view que está na lista (lixeira e ferramenta ficam fora).
 */
export async function buscarColunasNoOracle(
  organizationId: string,
  config: OracleConfig,
  termo: string,
  limite: number,
): Promise<ColunaEncontrada[]> {
  const lista = await listarTabelasDoOracle(organizationId, config);
  const visiveis = new Set(lista.map((tabela) => chaveDaTabela(tabela)));
  const donos = [...new Set(lista.map((tabela) => tabela.schema))];
  if (donos.length === 0) return [];
  const { lista: listaDeDonos, binds } = listaDeBinds(donos, "d");
  const linhas = await withOracleReadOnly(
    config,
    (query) =>
      query<LinhaDaBusca>(sqlBuscarColunas(listaDeDonos), {
        ...binds,
        termo: padraoDeBusca(termo),
        // Folga para o que o filtro de visíveis descartar.
        limite: limite * 2,
      }),
    { callTimeoutMs: PRAZO_DA_LISTA_MS },
  );
  return linhas
    .filter((linha) =>
      visiveis.has(chaveDaTabela({ schema: linha.DONO, nome: linha.TABELA })),
    )
    .slice(0, limite)
    .map((linha) => ({
      tabela: { schema: linha.DONO, nome: linha.TABELA },
      coluna: linha.COLUNA,
      tipoNativo: linha.TIPO,
      comentario: linha.COMENTARIO?.trim() || null,
    }));
}
