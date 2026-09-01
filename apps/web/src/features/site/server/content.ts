import "server-only";

import {
  DEFAULT_CONTENT,
  type MenuEntry,
  type MenuGroup,
  type SiteContent,
} from "@/app/(home)/_components/orbita/data/content";
import prisma from "@/lib/db";
import { siteSettingsSchema } from "@/app/router/site/settings";

/**
 * Monta o conteúdo do site a partir do banco.
 *
 * Regra do fallback: painel SEM NENHUMA LINHA cai no conteúdo que vem no
 * código. Não é "mesclar" — se a tabela tem itens, ela manda; se está vazia, o
 * site continua igual ao de hoje. Isso é o que permite subir o admin antes de
 * cadastrar qualquer coisa, e é o que segura o site de pé se alguém apagar uma
 * lista sem querer.
 */
export async function getSiteContent(): Promise<SiteContent> {
  // Uma consulta só: são poucas linhas e três painéis.
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
        page: { select: { slug: true, status: true } },
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
        ? `/solucoes/${item.page.slug}`
        : (item.href ?? undefined),
    color: item.color ?? undefined,
    iconImage: item.iconImage ?? undefined,
  });

  const grouped = (panel: "SOLUCOES" | "SEGMENTOS" | "SOBRE"): MenuGroup[] => {
    const rows = items.filter((i) => i.panel === panel);
    const groups: MenuGroup[] = [];
    for (const row of rows) {
      const existing = groups.find((g) => g.title === row.groupTitle);
      if (existing) existing.items.push(toEntry(row));
      else groups.push({ title: row.groupTitle, items: [toEntry(row)] });
    }
    return groups;
  };

  const solucoes = grouped("SOLUCOES");
  const segmentos = items.filter((i) => i.panel === "SEGMENTOS").map(toEntry);
  const sobreGroups = grouped("SOBRE");

  // No painel "Sobre nós", a coluna chamada "Destaque" vira o bloco grande à
  // direita — sem sub-itens, ele repetiria o próprio link como coluna.
  const highlightGroup = sobreGroups.find(
    (g) => g.title.toLowerCase() === "destaque",
  );
  const highlightItem = highlightGroup?.items[0];

  const settings = siteSettingsSchema.safeParse(settingRow?.value ?? {});
  const stats =
    settings.success && settings.data.stats.length
      ? settings.data.stats
      : DEFAULT_CONTENT.stats;
  const contact =
    settings.success && settings.data.contact.email
      ? settings.data.contact
      : DEFAULT_CONTENT.contact;
  const whatsapp =
    settings.success && settings.data.whatsapp.number
      ? {
          number: settings.data.whatsapp.number,
          href: `https://wa.me/${settings.data.whatsapp.number}`,
          label: settings.data.whatsapp.label,
        }
      : DEFAULT_CONTENT.whatsapp;

  return {
    solucoes: solucoes.length ? solucoes : DEFAULT_CONTENT.solucoes,
    segmentos: segmentos.length ? segmentos : DEFAULT_CONTENT.segmentos,
    sobre: sobreGroups.length
      ? {
          groups: sobreGroups.filter((g) => g !== highlightGroup),
          highlight: highlightItem
            ? { ...highlightItem, action: "Ver as trilhas" }
            : DEFAULT_CONTENT.sobre.highlight,
        }
      : DEFAULT_CONTENT.sobre,
    stats,
    contact,
    whatsapp,
  };
}
