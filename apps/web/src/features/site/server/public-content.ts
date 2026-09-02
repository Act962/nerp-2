import "server-only";

import type {
  MenuEntry,
  MenuGroup,
  SiteContentResponse,
} from "@nerp/site-content";
import prisma from "@/lib/db";
import { siteSettingsSchema } from "@/app/router/site/settings";

/**
 * O conteúdo publicado do site, do jeito que ele sai do banco.
 *
 * Sem valor padrão nenhum aqui, de propósito: painel vazio volta vazio. Quem
 * decide o que mostrar no vazio é o `apps/site`, que tem o catálogo — e é lá
 * que o fallback pode continuar valendo mesmo se este app estiver fora do ar.
 */
/** O primeiro pedaço da URL de cada seção. */
const SECAO_URL = {
  SOLUCOES: "solucoes",
  SEGMENTOS: "segmentos",
  SOBRE: "sobre",
} as const;

export async function getPublicSiteContent(): Promise<SiteContentResponse> {
  const [items, settingRow] = await Promise.all([
    prisma.siteMenuItem.findMany({
      where: { visible: true },
      orderBy: [{ position: "asc" }],
      select: {
        panel: true,
        groupTitle: true,
        slug: true,
        name: true,
        summary: true,
        color: true,
        href: true,
        iconImage: true,
        page: { select: { slug: true, section: true, status: true } },
      },
    }),
    prisma.siteSetting.findUnique({ where: { key: "site" } }),
  ]);

  const toEntry = (item: (typeof items)[number]): MenuEntry => ({
    id: item.slug,
    name: item.name,
    summary: item.summary,
    // Página interna publicada ganha do campo de link livre: é o destino que o
    // próprio admin acabou de construir.
    href:
      item.page && item.page.status === "PUBLISHED"
        ? `/${SECAO_URL[item.page.section]}/${item.page.slug}`
        : (item.href ?? undefined),
    color: item.color ?? undefined,
    iconImage: item.iconImage ?? undefined,
  });

  const grouped = (panel: "SOLUCOES" | "SEGMENTOS" | "SOBRE"): MenuGroup[] => {
    const groups: MenuGroup[] = [];
    for (const row of items.filter((i) => i.panel === panel)) {
      const existing = groups.find((g) => g.title === row.groupTitle);
      if (existing) existing.items.push(toEntry(row));
      else groups.push({ title: row.groupTitle, items: [toEntry(row)] });
    }
    return groups;
  };

  const sobreGroups = grouped("SOBRE");
  // A coluna chamada "Destaque" vira o bloco grande à direita do painel: sem
  // sub-itens, ela repetiria o próprio link como coluna.
  const highlightGroup = sobreGroups.find(
    (g) => g.title.toLowerCase() === "destaque",
  );
  const highlightItem = highlightGroup?.items[0];

  const parsed = siteSettingsSchema.safeParse(settingRow?.value ?? {});
  const settings = parsed.success ? parsed.data : null;

  return {
    solucoes: grouped("SOLUCOES"),
    segmentos: items.filter((i) => i.panel === "SEGMENTOS").map(toEntry),
    sobre: {
      groups: sobreGroups.filter((g) => g !== highlightGroup),
      highlight: highlightItem
        ? { ...highlightItem, action: "Ver as trilhas" }
        : null,
    },
    stats: settings?.stats ?? [],
    contact: settings?.contact.email ? settings.contact : null,
    whatsapp: settings?.whatsapp.number ? settings.whatsapp : null,
  };
}
