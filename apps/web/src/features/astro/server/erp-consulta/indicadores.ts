import { z } from "zod";
import { STORE_TZ } from "@/features/sales/lib/period-range";
import type {
  OracleQueryConfig,
  OracleQueryFilter,
  OracleQueryMeasure,
} from "@/features/dashboard-widgets/lib/oracle-query-config";

/**
 * Os números que o Astro sabe tirar do Oracle do Winthor.
 *
 * O modelo escolhe um INDICADOR, não uma tabela. Deixar o modelo montar a
 * consulta (tabela PCPREST, coluna DTVENC, filtro DTPAG vazio) seria pedir que
 * ele acerte em silêncio o que o construtor do dashboard pede a um humano com
 * dicionário na tela — e o erro de coluna trocada não estoura, só dá o número
 * errado. Com o enum, o erro é ele não achar o indicador, que é alto e honesto.
 *
 * Módulo puro: decide o que falta, monta a config e escreve o recorte. Quem
 * vai ao Oracle é `tools/erp.ts`.
 */

export const INDICADORES = [
  "inadimplencia",
  "clientesSemCompra",
  "vendas",
] as const;
export type Indicador = (typeof INDICADORES)[number];

/** Código de "cliente sem filial no cadastro" — só onde a coluna aceita vazio. */
export const SEM_FILIAL = "sem";
/** Sem recorte de filial: a empresa inteira. */
export const TODAS_AS_FILIAIS = "todas";

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD.");

export const periodoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("haMaisDe"),
    // 0 é "qualquer coisa antes de hoje" — "todas as vencidas".
    dias: z.number().int().min(0).max(3650),
    /** "desde 2026": só conta o que aconteceu a partir desta data. */
    desde: dataIso.optional(),
  }),
  z.object({
    tipo: z.literal("ultimos"),
    dias: z.number().int().min(1).max(3650),
  }),
  z.object({ tipo: z.literal("intervalo"), de: dataIso, ate: dataIso }),
]);
export type Periodo = z.infer<typeof periodoSchema>;
type TipoDePeriodo = Periodo["tipo"];

export type Filial = { codigo: string; nome: string };

type Definicao = {
  rotulo: string;
  tabela: string;
  colunaFilial: string;
  /** A coluna de filial pode vir vazia (cadastro de cliente) e isso é um grupo. */
  aceitaSemFilial: boolean;
  colunaData: string;
  /** Como a data se chama na frase do recorte. */
  sentidoDaData: string;
  periodos: TipoDePeriodo[];
  /** Data máxima permitida: vencido é sempre até ontem. */
  ateNoMaximoOntem: boolean;
  medidas: OracleQueryMeasure[];
  filtrosFixos: OracleQueryFilter[];
  salesFilter: OracleQueryConfig["salesFilter"];
  /** O que vai na lista por cliente, quando pedem nomes. */
  lista: OracleQueryMeasure;
  /** As perguntas de período, com as respostas mais comuns como botão. */
  opcoesDePeriodo: string[];
};

export const DEFINICOES: Record<Indicador, Definicao> = {
  // PCPREST é a tabela de parcelas: inadimplente é quem tem parcela vencida e
  // não paga. Mesma regra do modelo "Total em atraso" do dashboard.
  inadimplencia: {
    rotulo: "Inadimplência",
    tabela: "PCPREST",
    colunaFilial: "CODFILIAL",
    aceitaSemFilial: false,
    colunaData: "DTVENC",
    sentidoDaData: "vencimento",
    periodos: ["haMaisDe", "ultimos", "intervalo"],
    ateNoMaximoOntem: true,
    medidas: [
      {
        aggregation: "COUNT_DISTINCT",
        column: "CODCLI",
        label: "Clientes inadimplentes",
        unit: "number",
      },
      {
        aggregation: "SUM",
        column: "VALOR",
        label: "Valor em atraso",
        unit: "currency",
      },
    ],
    filtrosFixos: [{ column: "DTPAG", operator: "isNull", values: [] }],
    salesFilter: null,
    lista: {
      aggregation: "SUM",
      column: "VALOR",
      label: "Em atraso",
      unit: "currency",
    },
    opcoesDePeriodo: [
      "Vencidas há mais de 30 dias",
      "Vencidas há mais de 90 dias",
      "Vencidas este ano",
      "Todas as vencidas",
    ],
  },
  // DTULTCOMP é a última compra no cadastro. Excluído (DTEXCLUSAO) fica de
  // fora: cliente apagado não é cliente parado.
  clientesSemCompra: {
    rotulo: "Clientes sem compra",
    tabela: "PCCLIENT",
    colunaFilial: "CODFILIALNF",
    aceitaSemFilial: true,
    colunaData: "DTULTCOMP",
    sentidoDaData: "última compra",
    periodos: ["haMaisDe", "intervalo"],
    ateNoMaximoOntem: false,
    medidas: [
      { aggregation: "COUNT", column: null, label: "Clientes", unit: "number" },
    ],
    filtrosFixos: [{ column: "DTEXCLUSAO", operator: "isNull", values: [] }],
    salesFilter: null,
    lista: {
      aggregation: "MAX",
      column: "DTULTCOMP",
      label: "Última compra",
      unit: "number",
    },
    opcoesDePeriodo: [
      "Sem compra há mais de 30 dias",
      "Sem compra há mais de 60 dias",
      "Sem compra há mais de 90 dias",
      "Sem compra há mais de 90 dias, com compra em 2026",
    ],
  },
  // Pedidos válidos (`salesFilter: valid`) — o mesmo número do ranking.
  vendas: {
    rotulo: "Vendas",
    tabela: "PCPEDC",
    colunaFilial: "CODFILIAL",
    aceitaSemFilial: false,
    colunaData: "DATA",
    sentidoDaData: "data do pedido",
    periodos: ["ultimos", "intervalo"],
    ateNoMaximoOntem: false,
    medidas: [
      {
        aggregation: "SUM",
        column: "VLTOTAL",
        label: "Faturamento",
        unit: "currency",
      },
      { aggregation: "COUNT", column: null, label: "Pedidos", unit: "number" },
    ],
    filtrosFixos: [],
    salesFilter: "valid",
    lista: {
      aggregation: "SUM",
      column: "VLTOTAL",
      label: "Comprou",
      unit: "currency",
    },
    opcoesDePeriodo: ["Hoje", "Últimos 7 dias", "Este mês", "Este ano"],
  },
};

const ROTULO_DO_TIPO: Record<TipoDePeriodo, string> = {
  haMaisDe: "há mais de N dias",
  ultimos: "últimos N dias",
  intervalo: "de uma data a outra",
};

export type Falta = "filial" | "periodo";

/**
 * O que ainda falta para a resposta sair certa.
 *
 * Período de um tipo que não serve ao indicador ("vendas há mais de 90 dias")
 * conta como faltando: perguntar de novo é melhor do que responder outra coisa.
 */
export function oQueFalta(
  indicador: Indicador,
  entrada: { filiais?: string[]; periodo?: Periodo },
): Falta[] {
  const definicao = DEFINICOES[indicador];
  const falta: Falta[] = [];
  if (!entrada.filiais || entrada.filiais.length === 0) falta.push("filial");
  if (!entrada.periodo || !definicao.periodos.includes(entrada.periodo.tipo)) {
    falta.push("periodo");
  }
  return falta;
}

export type Escolha = {
  campo: Falta;
  pergunta: string;
  /** `envio` é o que vai como mensagem da pessoa ao tocar no botão. */
  opcoes: { rotulo: string; envio: string }[];
};

export function rotuloDaFilial(codigo: string, filiais: Filial[]): string {
  if (codigo === SEM_FILIAL) return "Sem filial no cadastro";
  if (codigo === TODAS_AS_FILIAIS) return "Todas as filiais";
  const filial = filiais.find((item) => item.codigo === codigo);
  return filial && filial.nome !== codigo
    ? `Filial ${codigo} · ${filial.nome}`
    : `Filial ${codigo}`;
}

export function escolhasPara(
  indicador: Indicador,
  falta: Falta[],
  filiais: Filial[],
): Escolha[] {
  const definicao = DEFINICOES[indicador];
  const escolhas: Escolha[] = [];

  if (falta.includes("filial")) {
    const codigos = [
      ...filiais.map((filial) => filial.codigo),
      ...(definicao.aceitaSemFilial ? [SEM_FILIAL] : []),
      TODAS_AS_FILIAIS,
    ];
    escolhas.push({
      campo: "filial",
      pergunta: "De qual filial?",
      opcoes: codigos.map((codigo) => {
        const rotulo = rotuloDaFilial(codigo, filiais);
        return { rotulo, envio: rotulo };
      }),
    });
  }

  if (falta.includes("periodo")) {
    escolhas.push({
      campo: "periodo",
      pergunta: `Qual período (${definicao.sentidoDaData})?`,
      opcoes: definicao.opcoesDePeriodo.map((rotulo) => ({
        rotulo,
        envio: rotulo,
      })),
    });
  }

  return escolhas;
}

/** Os tipos de período aceitos, para o modelo saber o que mandar. */
export function periodosAceitos(indicador: Indicador): string {
  return DEFINICOES[indicador].periodos
    .map((tipo) => ROTULO_DO_TIPO[tipo])
    .join(", ");
}

/**
 * O dia de hoje NA LOJA, como texto AAAA-MM-DD. O servidor roda em UTC: às
 * 22h de Fortaleza ele já está no dia seguinte, e "há mais de 60 dias" andaria
 * um dia antes da hora.
 */
function diaNaLoja(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ }).format(agora);
}

/** Conta de dias em cima de uma data AAAA-MM-DD, sem fuso no meio. */
function somarDias(dataIsoTexto: string, dias: number): string {
  const [ano, mes, dia] = dataIsoTexto.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return data.toISOString().slice(0, 10);
}

/** Antes disso, nenhuma data de negócio do Winthor: é o "desde sempre". */
const DESDE_SEMPRE = "1900-01-01";

export type Intervalo = { de: string; ate: string };

/**
 * O período vira um intervalo fechado de datas (as duas pontas incluídas),
 * calculado agora — "há mais de 60 dias" é "até hoje − 61".
 */
export function resolverPeriodo(
  indicador: Indicador,
  periodo: Periodo,
  agora: Date = new Date(),
): Intervalo | { erro: string } {
  const definicao = DEFINICOES[indicador];
  const hoje = diaNaLoja(agora);
  let intervalo: Intervalo;

  switch (periodo.tipo) {
    case "haMaisDe":
      intervalo = {
        de: periodo.desde ?? DESDE_SEMPRE,
        ate: somarDias(hoje, -(periodo.dias + 1)),
      };
      break;
    case "ultimos":
      intervalo = {
        de: somarDias(hoje, -(periodo.dias - 1)),
        ate: hoje,
      };
      break;
    case "intervalo":
      intervalo = { de: periodo.de, ate: periodo.ate };
      break;
  }

  if (definicao.ateNoMaximoOntem) {
    const ontem = somarDias(hoje, -1);
    if (intervalo.ate > ontem) intervalo.ate = ontem;
  }

  if (intervalo.de > intervalo.ate) {
    return {
      erro: `O período não tem nenhum dia: começa em ${brasileira(intervalo.de)} e termina em ${brasileira(intervalo.ate)}.`,
    };
  }
  return intervalo;
}

export function brasileira(dataIsoTexto: string): string {
  const [ano, mes, dia] = dataIsoTexto.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * A config de UMA consulta: uma medida, um recorte de filial.
 *
 * `filial` null é a empresa inteira; `SEM_FILIAL` é a coluna vazia; uma lista
 * de códigos vira `in`.
 */
export function montarConfig(entrada: {
  indicador: Indicador;
  filiais: string[] | null;
  intervalo: Intervalo;
  medida: OracleQueryMeasure;
  agruparPorCliente?: boolean;
  limite?: number;
}): OracleQueryConfig {
  const definicao = DEFINICOES[entrada.indicador];
  const filtros: OracleQueryFilter[] = [...definicao.filtrosFixos];

  if (entrada.filiais) {
    if (entrada.filiais.length === 1 && entrada.filiais[0] === SEM_FILIAL) {
      filtros.push({
        column: definicao.colunaFilial,
        operator: "isNull",
        values: [],
      });
    } else if (entrada.filiais.length === 1) {
      filtros.push({
        column: definicao.colunaFilial,
        operator: "eq",
        values: [entrada.filiais[0]],
      });
    } else {
      filtros.push({
        column: definicao.colunaFilial,
        operator: "in",
        values: entrada.filiais,
      });
    }
  }

  return {
    version: 1,
    table: definicao.tabela,
    measures: [entrada.medida],
    groupBy: entrada.agruparPorCliente
      ? { kind: "dimension", column: "CODCLI" }
      : { kind: "none" },
    dateFilter: {
      column: definicao.colunaData,
      preset: "custom",
      from: entrada.intervalo.de,
      to: entrada.intervalo.ate,
    },
    filters: filtros,
    salesFilter: definicao.salesFilter,
    orderBy: "measureDesc",
    limit: entrada.limite ?? 20,
  };
}

/**
 * Os grupos que viram consulta.
 *
 * O motor só junta filtros com AND, então "filial 1 + sem filial" não cabe numa
 * consulta: códigos vão juntos num `in`, e o vazio vai separado. "Todas"
 * engole o resto — é a empresa sem recorte nenhum.
 */
export function gruposDeFilial(filiais: string[]): (string[] | null)[] {
  if (filiais.includes(TODAS_AS_FILIAIS)) return [null];
  const codigos = filiais.filter((codigo) => codigo !== SEM_FILIAL);
  const grupos: (string[] | null)[] = [];
  if (codigos.length > 0) grupos.push(codigos);
  if (filiais.includes(SEM_FILIAL)) grupos.push([SEM_FILIAL]);
  return grupos;
}

/** A frase que acompanha todo número — o modelo cita, não reescreve. */
export function descreverRecorte(entrada: {
  indicador: Indicador;
  filiais: string[];
  periodo: Periodo;
  intervalo: Intervalo;
  todasAsFiliais: Filial[];
}): string {
  const definicao = DEFINICOES[entrada.indicador];
  const filiais = entrada.filiais
    .map((codigo) => rotuloDaFilial(codigo, entrada.todasAsFiliais))
    .join(" + ");

  const { de, ate } = entrada.intervalo;
  const datas =
    de === DESDE_SEMPRE
      ? `${definicao.sentidoDaData} até ${brasileira(ate)}`
      : `${definicao.sentidoDaData} de ${brasileira(de)} a ${brasileira(ate)}`;

  const leitura =
    entrada.periodo.tipo === "haMaisDe"
      ? ` (há mais de ${entrada.periodo.dias} dias${entrada.periodo.desde ? `, desde ${brasileira(entrada.periodo.desde)}` : ""})`
      : entrada.periodo.tipo === "ultimos"
        ? ` (últimos ${entrada.periodo.dias} dias)`
        : "";

  return `${definicao.rotulo} — ${filiais} — ${datas}${leitura}`;
}
