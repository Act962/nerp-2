import "server-only";

import type { coletaSchema } from "@nerp/site-content";
import type { z } from "zod";
import prisma from "@/lib/db";

type Coleta = z.output<typeof coletaSchema>;

/** Robôs não são público: contá-los inflaria visita e derrubaria a conversão. */
const ROBO_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|monitor/i;

export function ehRobo(userAgent: string | null): boolean {
  return !userAgent || ROBO_RE.test(userAgent);
}

/**
 * Grava um envio do navegador. Idempotente por construção — ver o comentário
 * da coleta em `@nerp/site-content`.
 */
export async function registrarColeta(coleta: Coleta) {
  const { visita } = coleta;
  const agora = new Date();

  await prisma.siteVisit.upsert({
    where: { id: visita.id },
    create: {
      id: visita.id,
      visitorId: visita.visitanteId,
      landingPath: visita.entrada,
      referrerHost: visita.origem || null,
      utmSource: visita.utmSource || null,
      utmMedium: visita.utmMedium || null,
      utmCampaign: visita.utmCampaign || null,
      utmContent: visita.utmContent || null,
      utmTerm: visita.utmTerm || null,
      device: visita.dispositivo,
    },
    // Origem e campanha são da CHEGADA: um envio posterior nunca as reescreve.
    update: { lastSeenAt: agora },
  });

  for (const pagina of coleta.paginas) {
    // GREATEST porque os beacons chegam fora de ordem: um pulso atrasado com
    // 20s não pode apagar a saída que já tinha registrado 45s. O `WHERE` do
    // conflito impede que um ID de página seja sequestrado por outra visita.
    await prisma.$executeRaw`
      INSERT INTO "site_page_views" ("id", "visitId", "path", "title", "activeSeconds", "maxScroll", "enteredAt")
      VALUES (${pagina.id}, ${visita.id}, ${pagina.path}, ${pagina.titulo ?? null}, ${pagina.segundos}, ${pagina.scroll}, ${agora})
      ON CONFLICT ("id") DO UPDATE SET
        "activeSeconds" = GREATEST("site_page_views"."activeSeconds", EXCLUDED."activeSeconds"),
        "maxScroll" = GREATEST("site_page_views"."maxScroll", EXCLUDED."maxScroll"),
        "title" = COALESCE("site_page_views"."title", EXCLUDED."title")
      WHERE "site_page_views"."visitId" = EXCLUDED."visitId"
    `;
  }

  if (coleta.eventos.length > 0) {
    await prisma.siteVisitEvent.createMany({
      data: coleta.eventos.map((evento) => ({
        visitId: visita.id,
        path: evento.path,
        label: evento.rotulo,
        target: evento.destino || null,
      })),
    });
  }
}
