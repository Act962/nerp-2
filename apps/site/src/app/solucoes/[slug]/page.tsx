import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteProductPage } from "@/features/product-page";
import { APP_LINKS, getProductPage, getSiteContent } from "@/lib/api";
import { assetUrl } from "@/lib/assets";

/**
 * A página interna de uma solução, montada pelo admin em `/site`.
 *
 * Só o publicado chega aqui — o `apps/web` responde 404 para rascunho, e um
 * rascunho realmente não existe para quem está de fora.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getProductPage("solucoes", slug);
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

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [page, content] = await Promise.all([
    getProductPage("solucoes", slug),
    getSiteContent(),
  ]);

  if (!page) notFound();

  return (
    <SiteProductPage
      blocks={page.blocks}
      whatsappHref={content.whatsapp.href}
      whatsappLabel={content.whatsapp.label}
      loginHref={APP_LINKS.login}
    />
  );
}
