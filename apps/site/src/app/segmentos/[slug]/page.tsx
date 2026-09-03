import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteProductPage } from "@/features/product-page";
import { APP_LINKS, getProductPage, getSiteContent } from "@/lib/api";
import { assetUrl } from "@/lib/assets";

/**
 * A página de um segmento: o que a suíte faz naquela operação.
 *
 * Mesma máquina da página de solução: os blocos publicados, montados pelo
 * admin. Só o publicado chega aqui — rascunho é 404, porque para quem está de
 * fora ele realmente não existe.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getProductPage("segmentos", slug);
  if (!page) return {};

  const title = page.seoTitle || `${page.title} — ÓRBITA HUB`;
  const description = page.seoDescription || undefined;
  const image = page.ogImage ? assetUrl(page.ogImage) : "";

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

export default async function SegmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [page, content] = await Promise.all([
    getProductPage("segmentos", slug),
    getSiteContent(),
  ]);

  if (!page) notFound();

  return (
    <SiteProductPage
      blocks={page.blocks}
      whatsappHref={content.whatsapp.href}
      whatsappLabel={content.whatsapp.label}
      loginHref={APP_LINKS.login}
      content={content}
    />
  );
}
