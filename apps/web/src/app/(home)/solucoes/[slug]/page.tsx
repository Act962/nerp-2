import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseBlocks } from "@/features/site/blocks";
import { SiteProductPage } from "@/features/site/components/product-page";
import { getSiteContent } from "@/features/site/server/content";
import { constructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/db";

/**
 * A página interna de uma solução.
 *
 * Só o PUBLICADO chega aqui: o rascunho fica no admin. Uma página em rascunho
 * é 404 no site, e não uma página meio pronta no ar.
 */
async function findPublished(slug: string) {
  return prisma.sitePage.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      publishedBlocks: true,
      seoTitle: true,
      seoDescription: true,
      ogImage: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await findPublished(slug);
  if (!page) return {};

  const title = page.seoTitle || `${page.title} — ÓRBITA HUB`;
  const description = page.seoDescription || undefined;
  const image = page.ogImage ? constructUrl(page.ogImage) : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [page, content] = await Promise.all([
    findPublished(slug),
    getSiteContent(),
  ]);

  if (!page) notFound();

  return (
    <SiteProductPage
      blocks={parseBlocks(page.publishedBlocks)}
      whatsappHref={content.whatsapp.href}
      whatsappLabel={content.whatsapp.label}
    />
  );
}
