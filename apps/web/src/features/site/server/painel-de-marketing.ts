import "server-only";

import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";

/**
 * O painel da aba Marketing: visitas, páginas, origens e leads do site.
 *
 * Agregado no Postgres, não em memória. O Órbita Pages carrega as últimas 10
 * mil linhas e soma em JS, e o próprio teto faz um período movimentado perder
 * o começo sem avisar; aqui cada número é um `GROUP BY` sobre o período todo.
 *
 * As definições que o painel mostra, para ninguém ter de adivinhar:
 *  - VISITA: sessão de navegação, encerrada após 30 min parada (no navegador).
 *  - REJEIÇÃO: visita de uma página só, com menos de 10s ativos e sem
 *    conversa com o Astro — o "não engajou" do GA4, não o "saiu da home".
 *  - SAÍDA de uma página: quantas visitas terminaram nela ÷ vezes que ela foi
 *    vista.
 *  - LEAD: diagnóstico registrado pelo Astro numa conversa do site. A origem
 *    dele é a da visita em que a conversa aconteceu.
 */

const FUSO = "America/Fortaleza";

export const painelDeMarketingSchema = z.object({
  dias: z.number(),
  resumo: z.object({
    visitas: z.number(),
    visitantes: z.number(),
    visitantesNovos: z.number(),
    paginasVistas: z.number(),
    duracaoMedia: z.number(),
    tempoMedioPorPagina: z.number(),
    rejeicoes: z.number(),
    conversas: z.number(),
    leads: z.number(),
    leadsRastreados: z.number(),
  }),
  serie: z.array(
    z.object({
      dia: z.string(),
      visitas: z.number(),
      paginasVistas: z.number(),
      leads: z.number(),
    }),
  ),
  paginas: z.array(
    z.object({
      path: z.string(),
      titulo: z.string().nullable(),
      visualizacoes: z.number(),
      visitantes: z.number(),
      tempoMedio: z.number(),
      scrollMedio: z.number(),
      entradas: z.number(),
      saidas: z.number(),
    }),
  ),
  origens: z.array(
    z.object({
      origem: z.string(),
      meio: z.string(),
      visitas: z.number(),
      visitantes: z.number(),
      rejeicoes: z.number(),
      leads: z.number(),
    }),
  ),
  campanhas: z.array(
    z.object({
      campanha: z.string(),
      origem: z.string().nullable(),
      meio: z.string().nullable(),
      visitas: z.number(),
      leads: z.number(),
    }),
  ),
  dispositivos: z.array(
    z.object({
      dispositivo: z.string(),
      visitas: z.number(),
      rejeicoes: z.number(),
    }),
  ),
  scroll: z.object({
    total: z.number(),
    p25: z.number(),
    p50: z.number(),
    p75: z.number(),
    p100: z.number(),
  }),
  cliques: z.array(
    z.object({
      rotulo: z.string(),
      destino: z.string().nullable(),
      cliques: z.number(),
      visitas: z.number(),
    }),
  ),
  leadsRecentes: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      empresa: z.string().nullable(),
      criadoEm: z.string(),
      origem: z.string().nullable(),
      campanha: z.string().nullable(),
      entrada: z.string().nullable(),
    }),
  ),
});

export type PainelDeMarketing = z.infer<typeof painelDeMarketingSchema>;

/** Hoje no fuso do site, `YYYY-MM-DD`. */
function hojeNoFuso(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
}

/**
 * O começo do período: meia-noite local de `dias - 1` dias atrás, para a série
 * ter exatamente `dias` barras e o dia de hoje contar inteiro.
 */
function inicioDoPeriodo(dias: number): { desde: Date; rotulos: string[] } {
  const [ano, mes, dia] = hojeNoFuso().split("-").map(Number);
  const rotulos: string[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    rotulos.push(
      new Date(Date.UTC(ano, mes - 1, dia - i)).toISOString().slice(0, 10),
    );
  }
  // Fortaleza é UTC−3 fixo (sem horário de verão desde 2019).
  const desde = new Date(Date.UTC(ano, mes - 1, dia - (dias - 1), 3));
  return { desde, rotulos };
}

const diaLocal = (coluna: Prisma.Sql) =>
  Prisma.sql`to_char((${coluna} AT TIME ZONE 'UTC') AT TIME ZONE ${FUSO}, 'YYYY-MM-DD')`;

/** Lead que nasceu de conversa no SITE — o canal do app também cria lead. */
const LEAD_DO_SITE = Prisma.sql`EXISTS (
  SELECT 1 FROM "site_chat_sessions" cs
  WHERE cs."leadId" = l."id" AND cs."channel" = 'SITE'
)`;

/** Uma linha por visita do período, com tudo que os recortes precisam. */
const visitasDoPeriodo = (desde: Date) => Prisma.sql`
  SELECT
    sv."id",
    sv."visitorId",
    sv."device",
    sv."utmSource",
    sv."utmMedium",
    sv."utmCampaign",
    COALESCE(NULLIF(sv."utmSource", ''), sv."referrerHost", '(direto)') AS origem,
    CASE
      WHEN sv."utmSource" IS NOT NULL THEN COALESCE(sv."utmMedium", 'campanha')
      WHEN sv."referrerHost" IS NOT NULL THEN 'referência'
      ELSE 'direto'
    END AS meio,
    (SELECT COUNT(*) FROM "site_page_views" p WHERE p."visitId" = sv."id") AS paginas,
    (SELECT COALESCE(SUM(p."activeSeconds"), 0) FROM "site_page_views" p WHERE p."visitId" = sv."id") AS segundos,
    EXISTS (SELECT 1 FROM "site_chat_sessions" cs WHERE cs."visitId" = sv."id") AS conversou,
    (SELECT COUNT(DISTINCT cs."leadId") FROM "site_chat_sessions" cs
      WHERE cs."visitId" = sv."id" AND cs."leadId" IS NOT NULL) AS leads,
    (SELECT MIN(x."startedAt") FROM "site_visits" x WHERE x."visitorId" = sv."visitorId") AS "primeiraVisita"
  FROM "site_visits" sv
  WHERE sv."startedAt" >= ${desde}
`;

const REJEITOU = Prisma.sql`(paginas <= 1 AND segundos < 10 AND NOT conversou)`;

export async function montarPainelDeMarketing(
  dias: number,
): Promise<PainelDeMarketing> {
  const { desde, rotulos } = inicioDoPeriodo(dias);
  const visitas = visitasDoPeriodo(desde);

  const [
    [resumo],
    [tempoPorPagina],
    [leads],
    visitasPorDia,
    paginasPorDia,
    leadsPorDia,
    paginas,
    origens,
    campanhas,
    dispositivos,
    [scroll],
    cliques,
    leadsRecentes,
  ] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        visitas: number;
        visitantes: number;
        visitantesNovos: number;
        paginasVistas: number;
        duracaoMedia: number;
        rejeicoes: number;
        conversas: number;
        leadsRastreados: number;
      }>
    >`
      WITH v AS (${visitas})
      SELECT
        COUNT(*)::int AS visitas,
        COUNT(DISTINCT "visitorId")::int AS visitantes,
        COUNT(DISTINCT "visitorId") FILTER (WHERE "primeiraVisita" >= ${desde})::int AS "visitantesNovos",
        COALESCE(SUM(paginas), 0)::int AS "paginasVistas",
        COALESCE(ROUND(AVG(segundos)), 0)::int AS "duracaoMedia",
        COUNT(*) FILTER (WHERE ${REJEITOU})::int AS rejeicoes,
        COUNT(*) FILTER (WHERE conversou)::int AS conversas,
        COALESCE(SUM(leads), 0)::int AS "leadsRastreados"
      FROM v
    `,
    prisma.$queryRaw<Array<{ tempo: number }>>`
      SELECT COALESCE(ROUND(AVG(p."activeSeconds")), 0)::int AS tempo
      FROM "site_page_views" p
      WHERE p."enteredAt" >= ${desde}
    `,
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total FROM "site_leads" l
      WHERE l."createdAt" >= ${desde} AND ${LEAD_DO_SITE}
    `,
    prisma.$queryRaw<Array<{ dia: string; total: number }>>`
      SELECT ${diaLocal(Prisma.sql`"startedAt"`)} AS dia, COUNT(*)::int AS total
      FROM "site_visits" WHERE "startedAt" >= ${desde}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ dia: string; total: number }>>`
      SELECT ${diaLocal(Prisma.sql`"enteredAt"`)} AS dia, COUNT(*)::int AS total
      FROM "site_page_views" WHERE "enteredAt" >= ${desde}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ dia: string; total: number }>>`
      SELECT ${diaLocal(Prisma.sql`l."createdAt"`)} AS dia, COUNT(*)::int AS total
      FROM "site_leads" l
      WHERE l."createdAt" >= ${desde} AND ${LEAD_DO_SITE}
      GROUP BY 1
    `,
    prisma.$queryRaw<PainelDeMarketing["paginas"]>`
      WITH pv AS (
        SELECT
          p."path", p."title", p."activeSeconds", p."maxScroll", v."visitorId",
          ROW_NUMBER() OVER (PARTITION BY p."visitId" ORDER BY p."enteredAt", p."id") AS ordem,
          ROW_NUMBER() OVER (PARTITION BY p."visitId" ORDER BY p."enteredAt" DESC, p."id" DESC) AS "ordemInversa"
        FROM "site_page_views" p
        JOIN "site_visits" v ON v."id" = p."visitId"
        WHERE v."startedAt" >= ${desde}
      )
      SELECT
        "path",
        MAX("title") AS titulo,
        COUNT(*)::int AS visualizacoes,
        COUNT(DISTINCT "visitorId")::int AS visitantes,
        COALESCE(ROUND(AVG("activeSeconds")), 0)::int AS "tempoMedio",
        COALESCE(ROUND(AVG("maxScroll")), 0)::int AS "scrollMedio",
        COUNT(*) FILTER (WHERE ordem = 1)::int AS entradas,
        COUNT(*) FILTER (WHERE "ordemInversa" = 1)::int AS saidas
      FROM pv
      GROUP BY "path"
      ORDER BY visualizacoes DESC
      LIMIT 20
    `,
    prisma.$queryRaw<PainelDeMarketing["origens"]>`
      WITH v AS (${visitas})
      SELECT
        origem,
        MIN(meio) AS meio,
        COUNT(*)::int AS visitas,
        COUNT(DISTINCT "visitorId")::int AS visitantes,
        COUNT(*) FILTER (WHERE ${REJEITOU})::int AS rejeicoes,
        COALESCE(SUM(leads), 0)::int AS leads
      FROM v
      GROUP BY origem
      ORDER BY visitas DESC
      LIMIT 15
    `,
    prisma.$queryRaw<PainelDeMarketing["campanhas"]>`
      WITH v AS (${visitas})
      SELECT
        "utmCampaign" AS campanha,
        MIN("utmSource") AS origem,
        MIN("utmMedium") AS meio,
        COUNT(*)::int AS visitas,
        COALESCE(SUM(leads), 0)::int AS leads
      FROM v
      WHERE "utmCampaign" IS NOT NULL AND "utmCampaign" <> ''
      GROUP BY "utmCampaign"
      ORDER BY visitas DESC
      LIMIT 15
    `,
    prisma.$queryRaw<PainelDeMarketing["dispositivos"]>`
      WITH v AS (${visitas})
      SELECT
        COALESCE("device", 'desktop') AS dispositivo,
        COUNT(*)::int AS visitas,
        COUNT(*) FILTER (WHERE ${REJEITOU})::int AS rejeicoes
      FROM v
      GROUP BY 1
      ORDER BY visitas DESC
    `,
    prisma.$queryRaw<Array<PainelDeMarketing["scroll"]>>`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "maxScroll" >= 25)::int AS p25,
        COUNT(*) FILTER (WHERE "maxScroll" >= 50)::int AS p50,
        COUNT(*) FILTER (WHERE "maxScroll" >= 75)::int AS p75,
        COUNT(*) FILTER (WHERE "maxScroll" >= 100)::int AS p100
      FROM "site_page_views"
      WHERE "enteredAt" >= ${desde}
    `,
    prisma.$queryRaw<PainelDeMarketing["cliques"]>`
      SELECT
        e."label" AS rotulo,
        MIN(e."target") AS destino,
        COUNT(*)::int AS cliques,
        COUNT(DISTINCT e."visitId")::int AS visitas
      FROM "site_visit_events" e
      WHERE e."createdAt" >= ${desde}
      GROUP BY e."label"
      ORDER BY cliques DESC
      LIMIT 15
    `,
    prisma.$queryRaw<
      Array<
        Omit<PainelDeMarketing["leadsRecentes"][number], "criadoEm"> & {
          criadoEm: Date;
        }
      >
    >`
      SELECT
        l."id", l."name" AS nome, l."company" AS empresa, l."createdAt" AS "criadoEm",
        COALESCE(NULLIF(v."utmSource", ''), v."referrerHost", CASE WHEN v."id" IS NOT NULL THEN '(direto)' END) AS origem,
        v."utmCampaign" AS campanha,
        v."landingPath" AS entrada
      FROM "site_leads" l
      LEFT JOIN LATERAL (
        SELECT sv.* FROM "site_chat_sessions" cs
        JOIN "site_visits" sv ON sv."id" = cs."visitId"
        WHERE cs."leadId" = l."id"
        ORDER BY cs."createdAt"
        LIMIT 1
      ) v ON true
      WHERE l."createdAt" >= ${desde} AND ${LEAD_DO_SITE}
      ORDER BY l."createdAt" DESC
      LIMIT 10
    `,
  ]);

  const porDia = (linhas: Array<{ dia: string; total: number }>) =>
    new Map(linhas.map((linha) => [linha.dia, linha.total]));
  const visitasMap = porDia(visitasPorDia);
  const paginasMap = porDia(paginasPorDia);
  const leadsMap = porDia(leadsPorDia);

  return {
    dias,
    resumo: {
      ...resumo,
      tempoMedioPorPagina: tempoPorPagina?.tempo ?? 0,
      leads: leads?.total ?? 0,
    },
    serie: rotulos.map((dia) => ({
      dia,
      visitas: visitasMap.get(dia) ?? 0,
      paginasVistas: paginasMap.get(dia) ?? 0,
      leads: leadsMap.get(dia) ?? 0,
    })),
    paginas,
    origens,
    campanhas,
    dispositivos,
    scroll: scroll ?? { total: 0, p25: 0, p50: 0, p75: 0, p100: 0 },
    cliques,
    leadsRecentes: leadsRecentes.map((lead) => ({
      ...lead,
      criadoEm: lead.criadoEm.toISOString(),
    })),
  };
}
