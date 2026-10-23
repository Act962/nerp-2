import { assertIdentifier } from "@/features/erp-sync/server/oracle-explorer/identifier";
import type { ValorCru } from "../../domain/converter";
import {
  type Tabela,
  type TabelaRef,
  type TipoDeDado,
  acharColuna,
} from "../../domain/estrutura";
import type { ColunaRef, Filtro } from "../../domain/mapeamento";
import type {
  PedidoDeAmostra,
  PedidoDeLeituraMapeada,
  PedidoDePerfil,
} from "../../ports/banco";

// Montadores de SQL do adaptador Oracle — puros, para o teste cobrir o que vai
// para o banco do cliente.
//
// Oracle não aceita bind em identificador, então tabela e coluna são sempre
// interpoladas — por isso toda interpolação passa por `citar`, que valida o
// nome antes, e só nomes que vieram do catálogo do próprio banco chegam aqui.
// Valor nunca é interpolado: vai sempre por bind.

export type Binds = Record<string, string | number>;

export interface Consulta {
  sql: string;
  binds: Binds;
}

/** Aspas preservam o nome exato do catálogo (inclusive `$` e `#`). */
export function citar(identificador: string): string {
  return `"${assertIdentifier(identificador)}"`;
}

export function nomeQualificado(ref: TabelaRef): string {
  return `${citar(ref.schema)}.${citar(ref.nome)}`;
}

export function tipoDeDado(tipoNativo: string): TipoDeDado {
  const tipo = tipoNativo.toUpperCase();
  if (tipo.startsWith("DATE") || tipo.startsWith("TIMESTAMP")) return "data";
  if (
    tipo === "NUMBER" ||
    tipo === "FLOAT" ||
    tipo === "INTEGER" ||
    tipo.startsWith("BINARY_")
  ) {
    return "numero";
  }
  if (
    tipo === "VARCHAR2" ||
    tipo === "NVARCHAR2" ||
    tipo === "CHAR" ||
    tipo === "NCHAR" ||
    tipo === "VARCHAR"
  ) {
    return "texto";
  }
  // CLOB, BLOB, LONG, RAW, XMLTYPE…: não dá para exibir nem comparar.
  return "outro";
}

/** `:p0, :p1…` para uma lista de valores comparados com IN. */
export function listaDeBinds(
  valores: string[],
  prefixo: string,
): { lista: string; binds: Binds } {
  const binds: Binds = {};
  const lista = valores
    .map((valor, indice) => {
      binds[`${prefixo}${indice}`] = valor;
      return `:${prefixo}${indice}`;
    })
    .join(", ");
  return { lista, binds };
}

// Usuários que não são do próprio Oracle (SYS, MDSYS, XDB…). O WMS do Winthor
// mora num schema próprio (SWMS), então o principal sozinho não basta.
export const SQL_DONOS = `SELECT username AS "USERNAME" FROM all_users WHERE oracle_maintained = 'N'`;

export function sqlListarTabelas(listaDeDonos: string): string {
  return `SELECT t.owner AS "DONO", t.table_name AS "NOME", 'TABELA' AS "TIPO",
                 t.num_rows AS "LINHAS", c.comments AS "COMENTARIO"
            FROM all_tables t
            LEFT JOIN all_tab_comments c
              ON c.owner = t.owner AND c.table_name = t.table_name
           WHERE t.owner IN (${listaDeDonos})
          UNION ALL
          SELECT v.owner, v.view_name, 'VIEW', NULL, c.comments
            FROM all_views v
            LEFT JOIN all_tab_comments c
              ON c.owner = v.owner AND c.table_name = v.view_name
           WHERE v.owner IN (${listaDeDonos})`;
}

export const SQL_COLUNAS = `SELECT c.column_name AS "NOME", c.data_type AS "TIPO",
       c.data_length AS "TAMANHO", c.data_precision AS "PRECISAO",
       c.data_scale AS "ESCALA", c.nullable AS "NULO", m.comments AS "COMENTARIO"
  FROM all_tab_columns c
  LEFT JOIN all_col_comments m
    ON m.owner = c.owner AND m.table_name = c.table_name AND m.column_name = c.column_name
 WHERE c.owner = :dono AND c.table_name = :tabela
 ORDER BY c.column_id`;

// Chave primária e estrangeiras DESTA tabela; a referência vem pela restrição
// apontada (`r_constraint_name`), casando coluna a coluna pela posição.
export const SQL_CHAVES = `SELECT k.constraint_name AS "NOME", k.constraint_type AS "TIPO",
       col.column_name AS "COLUNA", col.position AS "POSICAO",
       r.owner AS "REF_DONO", r.table_name AS "REF_TABELA", rcol.column_name AS "REF_COLUNA"
  FROM all_constraints k
  JOIN all_cons_columns col
    ON col.owner = k.owner AND col.constraint_name = k.constraint_name
  LEFT JOIN all_constraints r
    ON r.owner = k.r_owner AND r.constraint_name = k.r_constraint_name
  LEFT JOIN all_cons_columns rcol
    ON rcol.owner = r.owner AND rcol.constraint_name = r.constraint_name
   AND rcol.position = col.position
 WHERE k.owner = :dono AND k.table_name = :tabela AND k.constraint_type IN ('P', 'R')
 ORDER BY k.constraint_name, col.position`;

export const SQL_REFERENCIADA_POR = `SELECT k.constraint_name AS "NOME", k.owner AS "DONO", k.table_name AS "TABELA",
       col.column_name AS "COLUNA", rcol.column_name AS "REF_COLUNA", col.position AS "POSICAO"
  FROM all_constraints r
  JOIN all_constraints k
    ON k.r_owner = r.owner AND k.r_constraint_name = r.constraint_name
  JOIN all_cons_columns col
    ON col.owner = k.owner AND col.constraint_name = k.constraint_name
  JOIN all_cons_columns rcol
    ON rcol.owner = r.owner AND rcol.constraint_name = r.constraint_name
   AND rcol.position = col.position
 WHERE r.owner = :dono AND r.table_name = :tabela
   AND r.constraint_type IN ('P', 'U') AND k.constraint_type = 'R'
 ORDER BY k.constraint_name, col.position`;

export const SQL_INDICES = `SELECT i.index_name AS "NOME", i.uniqueness AS "UNICIDADE",
       ic.column_name AS "COLUNA", ic.column_position AS "POSICAO"
  FROM all_indexes i
  JOIN all_ind_columns ic
    ON ic.index_owner = i.owner AND ic.index_name = i.index_name
 WHERE i.table_owner = :dono AND i.table_name = :tabela
 ORDER BY i.index_name, ic.column_position`;

// Versões por schema (sem filtro de tabela), para o diagrama. Comentário de
// coluna fica de fora: o diagrama não mostra, e no Armazém são 4,5 mil colunas.
export const SQL_COLUNAS_DO_SCHEMA = `SELECT c.table_name AS "TABELA", c.column_name AS "NOME",
       c.data_type AS "TIPO", c.data_length AS "TAMANHO", c.data_precision AS "PRECISAO",
       c.data_scale AS "ESCALA", c.nullable AS "NULO", NULL AS "COMENTARIO"
  FROM all_tab_columns c
 WHERE c.owner = :dono
 ORDER BY c.table_name, c.column_id`;

export const SQL_CHAVES_DO_SCHEMA = `SELECT k.table_name AS "TABELA", k.constraint_name AS "NOME",
       k.constraint_type AS "TIPO", col.column_name AS "COLUNA", col.position AS "POSICAO",
       r.owner AS "REF_DONO", r.table_name AS "REF_TABELA", rcol.column_name AS "REF_COLUNA"
  FROM all_constraints k
  JOIN all_cons_columns col
    ON col.owner = k.owner AND col.constraint_name = k.constraint_name
  LEFT JOIN all_constraints r
    ON r.owner = k.r_owner AND r.constraint_name = k.r_constraint_name
  LEFT JOIN all_cons_columns rcol
    ON rcol.owner = r.owner AND rcol.constraint_name = r.constraint_name
   AND rcol.position = col.position
 WHERE k.owner = :dono AND k.constraint_type IN ('P', 'R')
 ORDER BY k.table_name, k.constraint_name, col.position`;

export const SQL_INDICES_DO_SCHEMA = `SELECT i.table_name AS "TABELA", i.index_name AS "NOME",
       i.uniqueness AS "UNICIDADE", ic.column_name AS "COLUNA", ic.column_position AS "POSICAO"
  FROM all_indexes i
  JOIN all_ind_columns ic
    ON ic.index_owner = i.owner AND ic.index_name = i.index_name
 WHERE i.table_owner = :dono
 ORDER BY i.table_name, i.index_name, ic.column_position`;

function colunaCanonica(tabela: Tabela, nome: string): string {
  const coluna = acharColuna(tabela, nome);
  if (!coluna) {
    throw new Error(`A coluna ${nome} não existe em ${tabela.nome}.`);
  }
  return citar(coluna.nome);
}

/**
 * Comparação por igualdade amigável a índice. Data vira intervalo de um dia em
 * vez de `TRUNC(coluna)`, que desligaria o índice da coluna.
 */
function condicaoDeIgualdade(
  expressao: string,
  tipo: TipoDeDado,
  bind: string,
): string {
  if (tipo === "data") {
    return `${expressao} >= TO_DATE(:${bind}, 'YYYY-MM-DD') AND ${expressao} < TO_DATE(:${bind}, 'YYYY-MM-DD') + 1`;
  }
  return `${expressao} = :${bind}`;
}

export function sqlAmostra(pedido: PedidoDeAmostra): Consulta {
  const { tabela } = pedido;
  const colunas = pedido.colunas.map((nome) => colunaCanonica(tabela, nome));
  const binds: Binds = {
    inicio: pedido.pagina * pedido.porPagina,
    // Uma a mais só para saber se existe próxima página.
    quantos: pedido.porPagina + 1,
  };
  const partes = [
    `SELECT ${colunas.join(", ")} FROM ${nomeQualificado(tabela)}`,
  ];
  if (pedido.filtro) {
    const coluna = acharColuna(tabela, pedido.filtro.coluna);
    if (!coluna) {
      throw new Error(`A coluna ${pedido.filtro.coluna} não existe.`);
    }
    binds.valor =
      coluna.tipo === "numero"
        ? Number(pedido.filtro.valor.replace(",", "."))
        : pedido.filtro.valor;
    partes.push(
      `WHERE ${condicaoDeIgualdade(citar(coluna.nome), coluna.tipo, "valor")}`,
    );
  }
  if (pedido.ordem) {
    const direcao = pedido.ordem.direcao === "desc" ? "DESC" : "ASC";
    partes.push(
      `ORDER BY ${colunaCanonica(tabela, pedido.ordem.coluna)} ${direcao}`,
    );
  }
  partes.push("OFFSET :inicio ROWS FETCH NEXT :quantos ROWS ONLY");
  return { sql: partes.join(" "), binds };
}

const OPERADOR_SQL = {
  igual: "=",
  diferente: "<>",
  maiorOuIgual: ">=",
  menorOuIgual: "<=",
} as const;

const CHAVE_DE_CAMPO = /^[A-Za-z]{1,30}$/;

/**
 * SELECT de um tipo do NERP a partir da origem mapeada. As colunas saem com o
 * NOME DO CAMPO do NERP como apelido (`"codigoProduto"`), então quem lê não
 * precisa saber de que tabela veio cada uma.
 *
 * Com `ultimoPor` no alvo (preço vindo do histórico de vendas), fica só a linha
 * mais recente de cada partição, via ROW_NUMBER.
 */
export function sqlLeituraMapeada(pedido: PedidoDeLeituraMapeada): Consulta {
  const { alvo, origem, base, juncao } = pedido;
  const binds: Binds = { limite: pedido.limite };

  const expressao = (ref: ColunaRef): string => {
    if (ref.de === "base") return `b.${colunaCanonica(base, ref.nome)}`;
    if (!juncao) throw new Error("A origem usa a junção, mas ela não existe.");
    return `j.${colunaCanonica(juncao, ref.nome)}`;
  };
  const tipoDa = (ref: ColunaRef): TipoDeDado => {
    const tabela = ref.de === "base" ? base : juncao;
    return (tabela && acharColuna(tabela, ref.nome)?.tipo) ?? "outro";
  };

  const campos = alvo.campos.filter((campo) => origem.colunas[campo.chave]);
  if (campos.length === 0) throw new Error("Nenhum campo mapeado.");
  const selecao = campos.map((campo) => {
    if (!CHAVE_DE_CAMPO.test(campo.chave)) {
      throw new Error(`Campo inválido: ${campo.chave}`);
    }
    return `${expressao(origem.colunas[campo.chave])} AS "${campo.chave}"`;
  });

  let de = `${nomeQualificado(base)} b`;
  if (origem.juncao) {
    if (!juncao) throw new Error("A tabela da junção não foi carregada.");
    de += ` JOIN ${nomeQualificado(juncao)} j ON j.${colunaCanonica(juncao, origem.juncao.para)} = b.${colunaCanonica(base, origem.juncao.de)}`;
  }

  const condicoes: string[] = [];
  if (origem.janela) {
    const dias = Math.min(
      origem.janela.dias,
      pedido.diasNoMaximo ?? origem.janela.dias,
    );
    binds.dias = dias;
    condicoes.push(
      `${expressao(origem.janela.coluna)} >= TRUNC(SYSDATE) - :dias`,
    );
  }
  origem.filtros.forEach((filtro, indice) => {
    condicoes.push(condicaoDoFiltro(filtro, `f${indice}_`, expressao, binds));
  });
  const campoChave = alvo.campos[0].chave;
  if (pedido.codigo && origem.colunas[campoChave]) {
    const ref = origem.colunas[campoChave];
    binds.codigo =
      tipoDa(ref) === "numero" && /^\d+$/.test(pedido.codigo)
        ? Number(pedido.codigo)
        : pedido.codigo;
    condicoes.push(`${expressao(ref)} = :codigo`);
  }
  // Leitura completa: página por chave ("depois de"), sem OFFSET — com OFFSET
  // o banco relê e descarta tudo o que veio antes, a cada página.
  const paginada = pedido.paginacao ?? null;
  const chaves = paginada ? camposDaChave(pedido) : [];
  const depoisDe = paginada?.depoisDe ?? null;
  const condicaoDaPagina = (
    expressaoDaChave: (campo: string) => string,
  ): string | null => {
    if (!depoisDe) return null;
    if (depoisDe.length !== chaves.length) {
      throw new Error("Cursor de página não combina com a chave do tipo.");
    }
    chaves.forEach((_, indice) => {
      binds[`k${indice}`] = depoisDe[indice] as string | number;
    });
    const [primeira, segunda] = chaves.map(expressaoDaChave);
    return segunda
      ? `(${primeira} > :k0 OR (${primeira} = :k0 AND ${segunda} > :k1))`
      : `${primeira} > :k0`;
  };

  const ordem = alvo.ultimoPor && origem.colunas[alvo.ultimoPor.ordem];
  if (paginada && !(alvo.ultimoPor && ordem)) {
    // Linha sem chave não tem como ser casada nem importada.
    for (const chave of chaves) {
      condicoes.push(`${expressao(origem.colunas[chave])} IS NOT NULL`);
    }
    const pagina = condicaoDaPagina((chave) =>
      expressao(origem.colunas[chave]),
    );
    if (pagina) condicoes.push(pagina);
    const ordenarPelaChave = chaves
      .map((chave) => `${expressao(origem.colunas[chave])} ASC`)
      .join(", ");
    return {
      sql: `SELECT ${selecao.join(", ")} FROM ${de} WHERE ${condicoes.join(" AND ")} ORDER BY ${ordenarPelaChave} FETCH FIRST :limite ROWS ONLY`,
      binds,
    };
  }

  const onde = condicoes.length ? ` WHERE ${condicoes.join(" AND ")}` : "";

  if (alvo.ultimoPor && ordem) {
    const particao = alvo.ultimoPor.particao
      .filter((chave) => origem.colunas[chave])
      .map((chave) => expressao(origem.colunas[chave]));
    const apelidos = campos.map((campo) => `"${campo.chave}"`).join(", ");
    const ordemDaJanela = expressao(ordem);
    const interna = `SELECT ${selecao.join(", ")}, ROW_NUMBER() OVER (PARTITION BY ${particao.join(", ")} ORDER BY ${ordemDaJanela} DESC) AS "RN__" FROM ${de}${onde}`;
    if (paginada) {
      const pagina = condicaoDaPagina((chave) => `"${chave}"`);
      const ordenar = chaves.map((chave) => `"${chave}" ASC`).join(", ");
      return {
        sql: `SELECT ${apelidos} FROM (${interna}) WHERE "RN__" = 1${pagina ? ` AND ${pagina}` : ""} ORDER BY ${ordenar} FETCH FIRST :limite ROWS ONLY`,
        binds,
      };
    }
    return {
      sql: `SELECT ${apelidos} FROM (${interna}) WHERE "RN__" = 1 ORDER BY "${alvo.ultimoPor.ordem}" DESC FETCH FIRST :limite ROWS ONLY`,
      binds,
    };
  }

  const ordenar = origem.janela
    ? ` ORDER BY ${expressao(origem.janela.coluna)} DESC`
    : "";
  return {
    sql: `SELECT ${selecao.join(", ")} FROM ${de}${onde}${ordenar} FETCH FIRST :limite ROWS ONLY`,
    binds,
  };
}

/** Campos da chave do alvo — todos precisam estar mapeados para paginar. */
function camposDaChave(pedido: PedidoDeLeituraMapeada): string[] {
  const faltando = pedido.alvo.chave.filter(
    (chave) => !pedido.origem.colunas[chave],
  );
  if (faltando.length > 0) {
    throw new Error(
      `Para ler tudo, o mapeamento precisa da chave: ${faltando.join(", ")}.`,
    );
  }
  if (pedido.alvo.chave.length > 2) {
    throw new Error("Chave com mais de 2 campos não é suportada.");
  }
  return pedido.alvo.chave;
}

function condicaoDoFiltro(
  filtro: Filtro,
  prefixo: string,
  expressao: (ref: ColunaRef) => string,
  binds: Binds,
): string {
  const coluna = expressao(filtro.coluna);
  switch (filtro.operador) {
    case "vazio":
      return `${coluna} IS NULL`;
    case "preenchido":
      return `${coluna} IS NOT NULL`;
    case "em": {
      const nomes = filtro.valores.map((valor, indice) => {
        binds[`${prefixo}${indice}`] = valor;
        return `:${prefixo}${indice}`;
      });
      return `${coluna} IN (${nomes.join(", ")})`;
    }
    default: {
      binds[`${prefixo}0`] = filtro.valores[0];
      return `${coluna} ${OPERADOR_SQL[filtro.operador]} :${prefixo}0`;
    }
  }
}

const doisDigitos = (numero: number) => String(numero).padStart(2, "0");

/**
 * DATE do Oracle não tem fuso: o driver monta o `Date` no fuso do processo.
 * Devolver `toISOString()` deslocava tudo para UTC — pedido de meia-noite
 * aparecia às 03:00. Aqui sai exatamente o que está gravado no ERP.
 */
export function dataSemFuso(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}:${doisDigitos(data.getSeconds())}`;
}

/**
 * Valor do driver para algo que atravessa a rede: data vira texto sem fuso, LOB/Buffer
 * (que não deveriam chegar aqui) viram nulo em vez de quebrar a serialização.
 */
export function valorCru(valor: unknown): ValorCru {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return dataSemFuso(valor);
  if (
    typeof valor === "string" ||
    typeof valor === "number" ||
    typeof valor === "boolean"
  ) {
    return valor;
  }
  if (typeof valor === "bigint") return Number(valor);
  return null;
}

// Formato do valor: dígito vira 9, maiúscula A, minúscula a. Agrupar por isso
// revela o que a coluna guarda sem mostrar dado nenhum ("99.999.999/9999-99"
// é CNPJ com máscara; "9999999999999" é EAN-13).
const DIGITOS_E_LETRAS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const FORMATO = `${"9".repeat(10)}${"A".repeat(26)}${"a".repeat(26)}`;
const MAX_FORMATOS = 8;

/**
 * `SAMPLE BLOCK` lê uma fração dos blocos da tabela: estatística de 17 milhões
 * de linhas sem varrê-las. O Oracle não aceita bind nessa cláusula; o
 * percentual vem do caso de uso (nunca do pedido) e sai como literal numérico.
 */
function clausulaDeAmostra(percentual: number | null): string {
  if (percentual === null) return "";
  if (!Number.isFinite(percentual) || percentual <= 0 || percentual >= 100) {
    throw new Error("Percentual de amostra inválido.");
  }
  return ` SAMPLE BLOCK (${percentual.toFixed(4)})`;
}

export interface ConsultasDoPerfil {
  estatisticas: Consulta;
  maisComuns: Consulta;
  formatos: Consulta | null;
}

export function sqlPerfilDaColuna(pedido: PedidoDePerfil): ConsultasDoPerfil {
  const coluna = acharColuna(pedido.tabela, pedido.coluna);
  if (!coluna) {
    throw new Error(
      `A coluna ${pedido.coluna} não existe em ${pedido.tabela.nome}.`,
    );
  }
  if (coluna.tipo === "outro") {
    throw new Error(`${coluna.nome} é binária e não tem perfil.`);
  }
  const c = citar(coluna.nome);
  const de = `${nomeQualificado(pedido.tabela)}${clausulaDeAmostra(pedido.percentualDeBlocos)}`;
  const tamanho =
    coluna.tipo === "texto"
      ? `, MIN(LENGTH(${c})) AS "TAMANHO_MIN", MAX(LENGTH(${c})) AS "TAMANHO_MAX"`
      : "";
  const formato = `TRANSLATE(SUBSTR(TO_CHAR(${c}), 1, 40), '${DIGITOS_E_LETRAS}', '${FORMATO}')`;
  return {
    estatisticas: {
      sql: `SELECT COUNT(*) AS "TOTAL", COUNT(${c}) AS "PREENCHIDAS", COUNT(DISTINCT ${c}) AS "DISTINTOS", MIN(${c}) AS "MINIMO", MAX(${c}) AS "MAXIMO"${tamanho} FROM ${de}`,
      binds: {},
    },
    maisComuns: {
      sql: `SELECT ${c} AS "VALOR", COUNT(*) AS "QUANTIDADE" FROM ${de} WHERE ${c} IS NOT NULL GROUP BY ${c} ORDER BY COUNT(*) DESC FETCH FIRST :quantos ROWS ONLY`,
      binds: { quantos: pedido.maisComuns },
    },
    formatos:
      pedido.comFormatos && coluna.tipo !== "data"
        ? {
            sql: `SELECT ${formato} AS "FORMATO", COUNT(*) AS "QUANTIDADE" FROM ${de} WHERE ${c} IS NOT NULL GROUP BY ${formato} ORDER BY COUNT(*) DESC FETCH FIRST ${MAX_FORMATOS} ROWS ONLY`,
            binds: {},
          }
        : null,
  };
}

/** `%TERMO%` para LIKE, com `%`, `_` e `\` do usuário tratados como texto. */
export function padraoDeBusca(termo: string): string {
  const escapado = termo
    .trim()
    .toUpperCase()
    .replace(/[\\%_]/g, (caractere) => `\\${caractere}`);
  return `%${escapado}%`;
}

export function sqlBuscarColunas(listaDeDonos: string): string {
  return `SELECT c.owner AS "DONO", c.table_name AS "TABELA", c.column_name AS "COLUNA",
                 c.data_type AS "TIPO", m.comments AS "COMENTARIO"
            FROM all_tab_columns c
            LEFT JOIN all_col_comments m
              ON m.owner = c.owner AND m.table_name = c.table_name AND m.column_name = c.column_name
           WHERE c.owner IN (${listaDeDonos})
             AND (c.column_name LIKE :termo ESCAPE '\\' OR UPPER(m.comments) LIKE :termo ESCAPE '\\')
           ORDER BY c.owner, c.table_name, c.column_id
           FETCH FIRST :limite ROWS ONLY`;
}
