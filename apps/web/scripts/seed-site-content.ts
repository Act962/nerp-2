import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ABOUT_PAGES,
  buildAllAboutPages,
  buildAllSegmentPages,
  buildAllSolutionPages,
  buildMetodoPage,
  findCatalogTool,
  MENU_COLUMNS,
  SEGMENTS,
  type SitePageSeed,
  solutionSlug,
} from "@nerp/site-content";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * Leva o conteúdo do site para o banco, para o admin ter de onde partir.
 *
 * Idempotente: pode rodar quantas vezes quiser. Cada item é `upsert` por
 * (painel, slug) e cada página por slug, e o que já foi editado no admin NÃO é
 * sobrescrito — o seed garante que a coisa EXISTE, não que ela está com o
 * texto original. Assim rodar de novo depois de uma edição não desfaz o
 * trabalho de ninguém.
 *
 *   pnpm --filter @nerp/web exec tsx scripts/seed-site-content.ts
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** O mesmo número do site. Fica aqui porque o seed também escreve os ajustes. */
const WHATSAPP = { number: "558698221810", label: "Agendar Demonstração" };
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP.number}`;

/** Traz o catálogo atualizado para páginas que já existem, e publica. */
const REFRESCAR = process.env.SEED_SITE_REFRESH === "1";

const SECAO = {
  solucoes: "SOLUCOES",
  segmentos: "SEGMENTOS",
  sobre: "SOBRE",
} as const;

/**
 * As páginas primeiro: o item do menu aponta para a página, e para apontar ela
 * precisa existir.
 */
async function seedPages() {
  const opcoes = { whatsappHref: WHATSAPP_HREF };
  const pages: SitePageSeed[] = [
    // O NERP é a ponte com o ERP: leva ao login, não tem página de vitrine.
    ...buildAllSolutionPages(opcoes).filter((page) => page.toolId !== "nerp"),
    ...buildAllSegmentPages(opcoes),
    ...buildAllAboutPages(opcoes),
    buildMetodoPage(opcoes),
  ];

  const idBySlug = new Map<string, string>();

  for (const page of pages) {
    const existing = await prisma.sitePage.findUnique({
      where: { slug: page.slug },
      select: { id: true },
    });

    const conteudo = page.blocks as unknown as Prisma.InputJsonValue;

    if (existing) {
      /*
        Página que já existe não é tocada — a não ser que peçam.

        O admin é a fonte de verdade depois do primeiro seed: reescrever os
        blocos aqui apagaria a edição de quem revisou. `SEED_SITE_REFRESH=1`
        existe para o caso oposto, o de trazer o catálogo atualizado para
        páginas que ninguém editou ainda.
      */
      if (REFRESCAR) {
        await prisma.sitePage.update({
          where: { id: existing.id },
          data: {
            title: page.title,
            section: SECAO[page.section],
            seoTitle: page.seoTitle,
            seoDescription: page.seoDescription,
            blocks: conteudo,
            publishedBlocks: conteudo,
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
        });
      }
      idBySlug.set(page.slug, existing.id);
      continue;
    }

    const created = await prisma.sitePage.create({
      data: {
        slug: page.slug,
        section: SECAO[page.section],
        title: page.title,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        blocks: conteudo,
        /*
          Nasce PUBLICADA.

          Era rascunho, com o argumento de que faltavam as imagens. Mas
          rascunho é 404 no site: o menu tem trinta e quatro itens, e todos
          levariam a lugar nenhum até alguém publicar um a um. O texto sai do
          catálogo e é verdadeiro; a imagem que falta o renderizador desenha
          como moldura vazia, e o cliente sobe pelo admin sem tocar em código.

          Uma página verdadeira e sem foto é melhor do que um 404.
        */
        publishedBlocks: conteudo,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    idBySlug.set(page.slug, created.id);
  }

  return idBySlug;
}

async function seedMenu(pageIdBySlug: Map<string, string>) {
  const ligar = (slug: string | null) =>
    slug ? (pageIdBySlug.get(slug) ?? null) : null;

  let position = 0;
  // As colunas do menu, e não as categorias da órbita: é assim que o painel
  // se organiza desde que os módulos da loja entraram.
  for (const column of MENU_COLUMNS) {
    for (const id of column.tools) {
      const tool = findCatalogTool(id);
      if (!tool) continue;
      const pageId = ligar(solutionSlug(tool.id));
      await prisma.siteMenuItem.upsert({
        where: { panel_slug: { panel: "SOLUCOES", slug: tool.id } },
        create: {
          panel: "SOLUCOES",
          groupTitle: column.title,
          slug: tool.id,
          name: tool.name,
          summary: tool.tagline,
          pageId,
          position: position++,
        },
        // Amarra a página mesmo em item que já existia — é o que faz o menu
        // apontar para ela assim que alguém publicar.
        update: { groupTitle: column.title, pageId: pageId ?? undefined },
      });
    }
  }

  position = 0;
  for (const segment of SEGMENTS) {
    const pageId = ligar(segment.id);
    await prisma.siteMenuItem.upsert({
      where: { panel_slug: { panel: "SEGMENTOS", slug: segment.id } },
      create: {
        panel: "SEGMENTOS",
        groupTitle: "Segmentos",
        slug: segment.id,
        name: segment.name,
        summary: segment.summary,
        color: segment.color,
        pageId,
        position: position++,
      },
      update: { pageId: pageId ?? undefined },
    });
  }

  position = 0;
  for (const page of ABOUT_PAGES) {
    const pageId = ligar(page.slug);
    await prisma.siteMenuItem.upsert({
      where: { panel_slug: { panel: "SOBRE", slug: page.id } },
      create: {
        panel: "SOBRE",
        groupTitle: page.group,
        slug: page.id,
        name: page.name,
        summary: page.summary,
        pageId,
        position: position++,
      },
      update: { groupTitle: page.group, pageId: pageId ?? undefined },
    });
  }
}

async function seedSettings() {
  await prisma.siteSetting.upsert({
    where: { key: "site" },
    create: {
      key: "site",
      value: {
        // Números de exemplo, de propósito: aparecem no admin marcados como
        // pendência até alguém trocar pelos reais.
        stats: [
          { value: "+500", label: "Clientes atendidos" },
          { value: "+1200", label: "Projetos entregues" },
          { value: "+8 anos", label: "De mercado" },
          { value: "100%", label: "Foco no cliente" },
        ],
        contact: {
          email: "contato@orbitahub.com.br",
          phone: "+55 (85) 0000-0000",
        },
        whatsapp: WHATSAPP,
      },
    },
    update: {},
  });
}

async function main() {
  const pageIdBySlug = await seedPages();
  await seedMenu(pageIdBySlug);
  await seedSettings();

  const [menu, pages, published] = await Promise.all([
    prisma.siteMenuItem.count(),
    prisma.sitePage.count(),
    prisma.sitePage.count({ where: { status: "PUBLISHED" } }),
  ]);
  console.log(
    `site: ${menu} itens de menu, ${pages} páginas (${published} publicadas)`,
  );
  if (!REFRESCAR) {
    console.log(
      "páginas que já existiam não foram tocadas — use SEED_SITE_REFRESH=1 para atualizá-las pelo catálogo.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
