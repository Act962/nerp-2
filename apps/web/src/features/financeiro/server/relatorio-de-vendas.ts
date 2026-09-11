import "server-only";

import {
  classificarAbc,
  type CriterioAbc,
  type CurvaAbc,
  type ItemVendido,
} from "@/features/financeiro/lib/curva-abc";
import {
  inicioDoDiaNaLoja,
  maisDias,
  STORE_TZ,
} from "@/features/sales/lib/period-range";
import {
  type IntervaloDeDatas,
  STATUS_VENDA_VALIDA,
  whereVendaValida,
} from "@/features/sales/lib/venda-valida";
import prisma from "@/lib/db";

/**
 * O que a loja vendeu: série no tempo, ticket médio e curva ABC.
 *
 * Tudo aqui usa `whereVendaValida` — a definição única de "venda que conta"
 * (CONFIRMED, PROCESSING e COMPLETED, pela data de criação). O relatório
 * financeiro não pode dar um número diferente do que o dashboard e o Astro
 * dão para o mesmo período; foi para acabar com isso que aquele arquivo existe.
 *
 * A série é agrupada no fuso da LOJA, e não em UTC: uma venda das 22h de
 * Fortaleza cai no dia seguinte em UTC, e o relatório diário mostraria
 * movimento num dia em que a loja estava fechada.
 */

export type GranularidadeDaSerie = "dia" | "mes";

export type PontoDaSerie = {
  /** Início do balde, em ISO. A tela decide como escrever. */
  inicio: string;
  total: number;
  vendas: number;
  ticketMedio: number;
};

export type ResumoDeVendas = {
  total: number;
  vendas: number;
  ticketMedio: number;
  descontos: number;
  itens: number;
};

const STATUS = [...STATUS_VENDA_VALIDA];

/**
 * Os dois dias do filtro ("YYYY-MM-DD", inclusivos) viram um intervalo
 * meio-aberto em instantes, no fuso da loja.
 *
 * O `to` do filtro é INCLUSIVO e o das consultas é exclusivo: sem somar um dia,
 * "01/09 a 30/09" perderia tudo o que foi vendido no dia 30. O meio-dia UTC na
 * conversão evita a borda do horário de verão — à meia-noite o deslocamento
 * pode ser o do dia anterior.
 */
export function intervaloDoFiltro(filtro: {
  from: string;
  to: string;
}): IntervaloDeDatas {
  const meioDia = (dia: string) => new Date(`${dia}T12:00:00.000Z`);
  return {
    from: inicioDoDiaNaLoja(meioDia(filtro.from), STORE_TZ),
    to: maisDias(inicioDoDiaNaLoja(meioDia(filtro.to), STORE_TZ), 1),
  };
}

/**
 * A série no tempo.
 *
 * `date_trunc` em SQL, e não agrupamento em memória: um ano de vendas de uma
 * loja média são dezenas de milhares de linhas, e trazê-las para contar no
 * Node desperdiça a única coisa que o banco faz melhor.
 */
export async function serieDeVendas(
  organizationId: string,
  intervalo: IntervaloDeDatas,
  granularidade: GranularidadeDaSerie,
): Promise<PontoDaSerie[]> {
  const unidade = granularidade === "mes" ? "month" : "day";

  const linhas = await prisma.$queryRaw<
    { balde: Date; total: number | null; vendas: bigint }[]
  >`
    SELECT date_trunc(${unidade}, "createdAt" AT TIME ZONE ${STORE_TZ}) AS balde,
           SUM("total")::float8 AS total,
           COUNT(*) AS vendas
      FROM "sales"
     WHERE "organizationId" = ${organizationId}
       AND "status"::text = ANY(${STATUS})
       AND "createdAt" >= ${intervalo.from}
       AND "createdAt" < ${intervalo.to}
     GROUP BY balde
     ORDER BY balde ASC
  `;

  return linhas.map((linha) => {
    const total = Number(linha.total ?? 0);
    const vendas = Number(linha.vendas);
    return {
      inicio: new Date(linha.balde).toISOString(),
      total: arredondar(total),
      vendas,
      ticketMedio: vendas > 0 ? arredondar(total / vendas) : 0,
    };
  });
}

/** Os números do período inteiro, que encabeçam a tela. */
export async function resumoDeVendas(
  organizationId: string,
  intervalo: IntervaloDeDatas,
): Promise<ResumoDeVendas> {
  const [vendas, itens] = await Promise.all([
    prisma.sale.aggregate({
      where: whereVendaValida(organizationId, intervalo),
      _sum: { total: true, discount: true },
      _count: { _all: true },
    }),
    prisma.saleItem.aggregate({
      where: { sale: whereVendaValida(organizationId, intervalo) },
      _sum: { quantity: true },
    }),
  ]);

  const total = Number(vendas._sum.total ?? 0);
  const quantidade = vendas._count._all;

  return {
    total: arredondar(total),
    vendas: quantidade,
    // Ticket médio é total ÷ vendas, e não a média das médias diárias: um dia
    // com uma venda pesaria igual a um dia com duzentas.
    ticketMedio: quantidade > 0 ? arredondar(total / quantidade) : 0,
    descontos: arredondar(Number(vendas._sum.discount ?? 0)),
    itens: arredondar(Number(itens._sum.quantity ?? 0)),
  };
}

/**
 * A curva ABC dos produtos do período.
 *
 * Soma no banco por produto e classifica em memória — a classificação é
 * sequencial sobre a lista já ordenada e não tem como virar SQL sem uma janela
 * que o Prisma não expõe. O `groupBy` devolve uma linha por produto vendido,
 * não uma por item: mesmo num ano cheio, é o tamanho do catálogo.
 */
export async function curvaAbcDeProdutos(
  organizationId: string,
  intervalo: IntervaloDeDatas,
  criterio: CriterioAbc,
): Promise<CurvaAbc> {
  const agrupado = await prisma.saleItem.groupBy({
    by: ["productId"],
    where: { sale: whereVendaValida(organizationId, intervalo) },
    _sum: { total: true, quantity: true },
  });

  if (agrupado.length === 0) return classificarAbc([], criterio);

  const produtos = await prisma.product.findMany({
    where: {
      id: { in: agrupado.map((linha) => linha.productId) },
      organizationId,
    },
    select: { id: true, name: true, sku: true },
  });
  const porId = new Map(produtos.map((produto) => [produto.id, produto]));

  const itens: ItemVendido[] = agrupado.map((linha) => {
    const produto = porId.get(linha.productId);
    return {
      produtoId: linha.productId,
      // Produto apagado depois da venda: o item continua no histórico e o
      // relatório não pode simplesmente perdê-lo do total.
      nome: produto?.name ?? "Produto removido",
      sku: produto?.sku ?? null,
      valor: arredondar(Number(linha._sum.total ?? 0)),
      volume: arredondar(Number(linha._sum.quantity ?? 0)),
    };
  });

  return classificarAbc(itens, criterio);
}

/** Duas casas, como todo dinheiro do sistema. */
function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
