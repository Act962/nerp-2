import "server-only";

import { emEstrelas } from "@/features/stars/lib/decimal";
import { whereVendaValidaGlobal } from "@/features/sales/lib/venda-valida";
import prisma from "@/lib/db";
import {
  type GastoDoProvedor,
  somarGastoDoProvedor,
} from "../lib/custo-gemini";

/**
 * O painel do dono da plataforma: todas as empresas de uma vez.
 *
 * **Este arquivo lê ATRAVÉS das organizações, de propósito.** É a única
 * exceção à regra que sustenta o resto do sistema — todo handler passa
 * `organizationId` e omiti-lo é vazamento. Aqui não há organização ativa:
 * quem chama é o administrador da plataforma, pela guarda
 * `requireSiteAdminMiddleware`, do mesmo jeito que as tabelas `site_*` são
 * globais.
 *
 * Por isso as consultas moram AQUI, num arquivo só, e não espalhadas em
 * handlers: um `findMany` sem `organizationId` perdido no meio de
 * `router/<entidade>/` é indistinguível de um bug. Neste arquivo ele é o
 * contrato.
 *
 * Nada daqui pode ser chamado por procedure de cliente.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Sem acesso há tanto tempo, a conta está parada. */
export const DIAS_SEM_GERIR = 14;

/** Catálogo mexido dentro desta janela conta como "ativo". */
export const DIAS_DE_CATALOGO_ATIVO = 30;

export type ResumoDaPlataforma = {
  empresas: { total: number; ativas: number; deTeste: number; paradas: number };
  vendas: { valorTotal: number; quantidade: number };
  catalogos: { montados: number; ativos: number };
  stars: { consumidasNoPeriodo: number; saldoEmCirculacao: number };
  gemini: GastoDoProvedor;
  /**
   * O gasto do MÊS corrente, que é o recorte do orçamento. Separado do
   * `gemini` acima de propósito: o período do painel é uma janela móvel, e
   * comparar sete dias com um teto mensal daria uma folga que não existe.
   */
  mes: { gasto: GastoDoProvedor; desde: string };
  /** O recorte usado, para a tela poder dizer de onde veio o número. */
  periodo: { de: string; ate: string; dias: number };
};

export async function resumoDaPlataforma(entrada: {
  dias: number;
  dolar: number;
  agora?: Date;
}): Promise<ResumoDaPlataforma> {
  const agora = entrada.agora ?? new Date();
  const desde = new Date(agora.getTime() - entrada.dias * DIA_MS);
  const corteDeGestao = new Date(agora.getTime() - DIAS_SEM_GERIR * DIA_MS);
  const corteDeCatalogo = new Date(
    agora.getTime() - DIAS_DE_CATALOGO_ATIVO * DIA_MS,
  );
  const inicioDoMes = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1),
  );

  const [
    total,
    deTeste,
    paradas,
    vendas,
    catalogosMontados,
    catalogosAtivos,
    consumo,
    saldos,
    sessoes,
    sessoesDoMes,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { verifiedAt: null } }),
    prisma.organization.count({
      where: {
        verifiedAt: { not: null },
        OR: [
          { lastAccessAt: { lt: corteDeGestao } },
          { lastAccessAt: null, createdAt: { lt: corteDeGestao } },
        ],
      },
    }),
    prisma.sale.aggregate({
      where: whereVendaValidaGlobal({ from: desde, to: agora }),
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.promotionalCatalog.count({ where: { isDemo: false } }),
    prisma.promotionalCatalog.count({
      where: { isDemo: false, updatedAt: { gte: corteDeCatalogo } },
    }),
    prisma.starTransaction.aggregate({
      where: { type: "APP_CHARGE", createdAt: { gte: desde } },
      _sum: { amount: true },
    }),
    prisma.organization.aggregate({ _sum: { starsBalance: true } }),
    prisma.siteChatSession.findMany({
      where: { channel: "APP", createdAt: { gte: desde } },
      select: { modelo: true, tokensIn: true, tokensOut: true },
    }),
    prisma.siteChatSession.findMany({
      where: { createdAt: { gte: inicioDoMes } },
      select: { modelo: true, tokensIn: true, tokensOut: true },
    }),
  ]);

  return {
    empresas: {
      total,
      // "Ativa" aqui é o oposto de parada, e não o status da assinatura: o
      // que interessa ao painel é quem está usando, não quem está pagando.
      ativas: total - deTeste - paradas,
      deTeste,
      paradas,
    },
    vendas: {
      valorTotal: Number(vendas._sum.total ?? 0),
      quantidade: vendas._count._all,
    },
    catalogos: { montados: catalogosMontados, ativos: catalogosAtivos },
    stars: {
      // `APP_CHARGE` é negativo no extrato; o painel mostra o consumo.
      consumidasNoPeriodo: Math.abs(emEstrelas(consumo._sum.amount)),
      saldoEmCirculacao: emEstrelas(saldos._sum.starsBalance),
    },
    gemini: somarGastoDoProvedor(sessoes, entrada.dolar),
    mes: {
      // Sem filtro de canal: a fatura do Google é uma só, e o consultor do
      // site consome da mesma chave que o Astro do app.
      gasto: somarGastoDoProvedor(sessoesDoMes, entrada.dolar),
      desde: inicioDoMes.toISOString(),
    },
    periodo: {
      de: desde.toISOString(),
      ate: agora.toISOString(),
      dias: entrada.dias,
    },
  };
}

export type LinhaDeEmpresa = {
  id: string;
  nome: string;
  slug: string;
  criadaEm: string;
  ultimoAcesso: string | null;
  contaDeTeste: boolean;
  parada: boolean;
  saldo: number;
  consumoNoPeriodo: number;
  tokens: number;
  custoGeminiReal: number;
  vendas: number;
  catalogos: number;
};

/**
 * Uma linha por empresa, com o que ela consumiu e o que gerou.
 *
 * As agregações vêm em `groupBy` e são casadas em memória. Um `include` por
 * organização faria uma consulta por linha — com cem empresas, cem consultas
 * por abertura de tela.
 */
export async function empresasComConsumo(entrada: {
  dias: number;
  dolar: number;
  agora?: Date;
}): Promise<LinhaDeEmpresa[]> {
  const agora = entrada.agora ?? new Date();
  const desde = new Date(agora.getTime() - entrada.dias * DIA_MS);
  const corteDeGestao = new Date(agora.getTime() - DIAS_SEM_GERIR * DIA_MS);

  const [orgs, consumo, sessoes, vendas, catalogos] = await Promise.all([
    prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        lastAccessAt: true,
        verifiedAt: true,
        starsBalance: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.starTransaction.groupBy({
      by: ["organizationId"],
      where: { type: "APP_CHARGE", createdAt: { gte: desde } },
      _sum: { amount: true },
    }),
    prisma.siteChatSession.findMany({
      where: {
        channel: "APP",
        createdAt: { gte: desde },
        organizationId: { not: null },
      },
      select: {
        organizationId: true,
        modelo: true,
        tokensIn: true,
        tokensOut: true,
      },
    }),
    prisma.sale.groupBy({
      by: ["organizationId"],
      where: whereVendaValidaGlobal({ from: desde, to: agora }),
      _sum: { total: true },
    }),
    prisma.promotionalCatalog.groupBy({
      by: ["organizationId"],
      where: { isDemo: false },
      _count: { _all: true },
    }),
  ]);

  const consumoPorOrg = new Map(
    consumo.map((linha) => [
      linha.organizationId,
      Math.abs(emEstrelas(linha._sum.amount)),
    ]),
  );
  const vendasPorOrg = new Map(
    vendas.map((linha) => [
      linha.organizationId,
      Number(linha._sum.total ?? 0),
    ]),
  );
  const catalogosPorOrg = new Map(
    catalogos.map((linha) => [linha.organizationId, linha._count._all]),
  );

  const sessoesPorOrg = new Map<string, typeof sessoes>();
  for (const sessao of sessoes) {
    if (!sessao.organizationId) continue;
    const lista = sessoesPorOrg.get(sessao.organizationId) ?? [];
    lista.push(sessao);
    sessoesPorOrg.set(sessao.organizationId, lista);
  }

  return orgs.map((org) => {
    const gasto = somarGastoDoProvedor(
      sessoesPorOrg.get(org.id) ?? [],
      entrada.dolar,
    );
    const referencia = org.lastAccessAt ?? org.createdAt;
    return {
      id: org.id,
      nome: org.name,
      slug: org.slug,
      criadaEm: org.createdAt.toISOString(),
      ultimoAcesso: org.lastAccessAt?.toISOString() ?? null,
      contaDeTeste: org.verifiedAt === null,
      parada: org.verifiedAt !== null && referencia < corteDeGestao,
      saldo: emEstrelas(org.starsBalance),
      consumoNoPeriodo: consumoPorOrg.get(org.id) ?? 0,
      tokens: gasto.tokensIn + gasto.tokensOut,
      custoGeminiReal: gasto.custoReal,
      vendas: vendasPorOrg.get(org.id) ?? 0,
      catalogos: catalogosPorOrg.get(org.id) ?? 0,
    };
  });
}
