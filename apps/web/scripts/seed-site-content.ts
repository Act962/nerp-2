import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import {
  ABOUT_GROUPS,
  ABOUT_HIGHLIGHT,
} from "@/app/(home)/_components/orbita/data/about";
import {
  TOOLS_BY_CATEGORY,
  findTool,
} from "@/app/(home)/_components/orbita/data/catalog";
import { SEGMENTS } from "@/app/(home)/_components/orbita/data/segments";
import { STATS, WHATSAPP } from "@/app/(home)/_components/orbita/data/site";

/**
 * Leva o conteúdo que hoje vive no código para o banco, para o admin do site
 * ter de onde partir.
 *
 * Idempotente: roda quantas vezes quiser. Cada item é `upsert` por
 * (painel, slug), e o que já foi editado no admin NÃO é sobrescrito — só
 * campos ausentes entram. Assim rodar de novo depois de uma edição não desfaz
 * o trabalho de ninguém.
 *
 *   pnpm --filter @nerp/web exec tsx scripts/seed-site-content.ts
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedMenu() {
  let position = 0;

  for (const group of TOOLS_BY_CATEGORY) {
    for (const tool of group.tools) {
      await prisma.siteMenuItem.upsert({
        where: { panel_slug: { panel: "SOLUCOES", slug: tool.id } },
        create: {
          panel: "SOLUCOES",
          groupTitle: group.title,
          slug: tool.id,
          name: tool.name,
          summary: tool.tagline,
          href: tool.href ?? null,
          position: position++,
        },
        // Nome e destino podem ter sido ajustados na tela; o que o seed
        // garante é que o item EXISTE e está na coluna certa.
        update: { groupTitle: group.title },
      });
    }
  }

  position = 0;
  for (const segment of SEGMENTS) {
    await prisma.siteMenuItem.upsert({
      where: { panel_slug: { panel: "SEGMENTOS", slug: segment.id } },
      create: {
        panel: "SEGMENTOS",
        groupTitle: "Segmentos",
        slug: segment.id,
        name: segment.name,
        summary: segment.summary,
        color: segment.color,
        position: position++,
      },
      update: {},
    });
  }

  position = 0;
  for (const group of ABOUT_GROUPS) {
    for (const item of group.items) {
      await prisma.siteMenuItem.upsert({
        where: { panel_slug: { panel: "SOBRE", slug: item.id } },
        create: {
          panel: "SOBRE",
          groupTitle: group.title,
          slug: item.id,
          name: item.name,
          summary: item.summary,
          position: position++,
        },
        update: { groupTitle: group.title },
      });
    }
  }

  // "Destaque" é a coluna que o site transforma no bloco grande à direita.
  await prisma.siteMenuItem.upsert({
    where: { panel_slug: { panel: "SOBRE", slug: ABOUT_HIGHLIGHT.id } },
    create: {
      panel: "SOBRE",
      groupTitle: "Destaque",
      slug: ABOUT_HIGHLIGHT.id,
      name: ABOUT_HIGHLIGHT.name,
      summary: ABOUT_HIGHLIGHT.summary,
      position: position++,
    },
    update: { groupTitle: "Destaque" },
  });
}

async function seedSettings() {
  await prisma.siteSetting.upsert({
    where: { key: "site" },
    create: {
      key: "site",
      value: {
        // Estes números seguem sendo os de exemplo do leiaute. Ficam aqui para
        // aparecerem na tela do admin e serem trocados por lá — o aviso do
        // painel continua marcando enquanto não forem.
        stats: STATS,
        contact: {
          email: "contato@orbitahub.com.br",
          phone: "+55 (85) 0000-0000",
        },
        whatsapp: { number: WHATSAPP.number, label: WHATSAPP.label },
      },
    },
    update: {},
  });
}

/**
 * A página do CRM Tracking, no formato aprovado. Ela nasce como RASCUNHO: o
 * texto sai do catálogo, mas as imagens e as logos de cliente ainda não
 * existem — publicar é uma decisão de quem revisa, não do seed.
 */
async function seedTrackingPage() {
  const tool = findTool("tracking");
  if (!tool) return;

  const existing = await prisma.sitePage.findUnique({
    where: { slug: "crm-tracking" },
    select: { id: true },
  });
  if (existing) return;

  const page = await prisma.sitePage.create({
    data: {
      slug: "crm-tracking",
      title: tool.name,
      seoTitle: `${tool.name} — ÓRBITA HUB`,
      seoDescription: tool.tagline,
      blocks: [
        {
          id: "hero",
          type: "hero",
          enabled: true,
          eyebrow: "O cliente chega e avança",
          title: "CRM Tracking: o funil que anda quando o card anda",
          text: tool.summary,
          primary: { label: "Agendar uma demonstração", href: WHATSAPP.href },
          secondary: { label: "Ver funcionalidades", href: "" },
          image: { key: "", alt: "" },
        },
        {
          id: "statement",
          type: "statement",
          enabled: true,
          title: "Um CRM que se adapta ao processo que a sua empresa já tem.",
          text: "Vários funis sobre a mesma base de contatos, com as etapas que o seu time usa todo dia.",
          cta: { label: "Falar com um especialista", href: WHATSAPP.href },
        },
        {
          id: "compare",
          type: "compare",
          enabled: true,
          title: "Com o CRM Tracking você terá",
          moreTitle: "MAIS",
          more: [
            "Todo o histórico do contato num lugar só",
            "Previsibilidade do que vai fechar",
            "Motivo registrado em cada perda",
            "O time inteiro olhando o mesmo funil",
          ],
          lessTitle: "MENOS",
          less: [
            "Lead esquecido na caixa de entrada",
            "Planilha paralela que só uma pessoa entende",
            "Reunião para descobrir em que pé está cada negócio",
            "Card parado sem ninguém perceber",
          ],
        },
        {
          id: "features",
          type: "features",
          enabled: true,
          title: "As cinco funcionalidades do CRM Tracking",
          items: tool.features.map((feature) => ({
            title: feature.title,
            text: feature.description,
          })),
        },
        {
          id: "split",
          type: "split",
          enabled: true,
          title: "O funil no bolso de quem está na rua",
          paragraphs: [
            "O vendedor move o card, registra o motivo e vê o histórico do contato sem voltar para o computador.",
          ],
          image: { key: "", alt: "" },
          imageSide: "left",
        },
        {
          id: "video",
          type: "video",
          enabled: true,
          title: "Mais que um sistema, uma parceria",
          text: "",
          youtubeUrl: "",
        },
        {
          id: "clients",
          type: "clients",
          enabled: true,
          title: "Nossos clientes",
          logos: [],
        },
        {
          id: "contact",
          type: "contact",
          enabled: true,
          title: "Vamos impulsionar a gestão do seu negócio?",
          options: [
            {
              kind: "whatsapp",
              label: "Converse por WhatsApp",
              href: WHATSAPP.href,
            },
            {
              kind: "callback",
              label: "Nós ligamos para você",
              href: WHATSAPP.href,
            },
          ],
        },
      ],
    },
    select: { id: true },
  });

  // Amarra a página ao item do menu: com ela publicada, o menu passa a
  // apontar para /solucoes/crm-tracking sozinho.
  await prisma.siteMenuItem.updateMany({
    where: { panel: "SOLUCOES", slug: "tracking" },
    data: { pageId: page.id },
  });
}

async function main() {
  await seedMenu();
  await seedSettings();
  await seedTrackingPage();

  const [menu, pages] = await Promise.all([
    prisma.siteMenuItem.count(),
    prisma.sitePage.count(),
  ]);
  console.log(`site: ${menu} itens de menu, ${pages} páginas`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
