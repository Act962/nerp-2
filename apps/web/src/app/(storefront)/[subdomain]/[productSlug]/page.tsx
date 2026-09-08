import type { Metadata } from "next";
import { DetailsPoduct } from "@/features/storefront/components/details-product";
import {
  descricaoCurta,
  ROBOTS_VITRINE,
  storeCanonical,
} from "@/features/storefront/lib/seo";
import { constructUrl } from "@/hooks/use-construct-url";
import prisma from "@/lib/db";

interface ProductProps {
  params: Promise<{
    subdomain: string;
    productSlug: string;
  }>;
}

/**
 * O metadata de um produto da vitrine.
 *
 * Antes não existia: a página herdava o do layout, então TODOS os produtos de
 * uma loja — e o catálogo, e a página "sobre nós" — saíam com o mesmo título e
 * a mesma descrição. Para o buscador isso é um site inteiro de páginas
 * indistinguíveis, e a página de produto é justamente a que traz a busca por
 * nome de produto, que é como alguém acha uma loja pequena.
 *
 * A consulta é direta no Prisma, e não pelo oRPC, seguindo o que o layout ao
 * lado já faz: `generateMetadata` roda no servidor, precisa de quatro campos e
 * a procedure pública traz o produto inteiro mais os relacionados da categoria.
 */
export async function generateMetadata({
  params,
}: ProductProps): Promise<Metadata> {
  const { subdomain, productSlug } = await params;

  const organization = await prisma.organization.findUnique({
    where: { subdomain },
    select: { id: true, name: true },
  });
  if (!organization) return { robots: { index: false, follow: false } };

  const product = await prisma.product.findUnique({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: productSlug,
      },
    },
    select: { name: true, description: true, thumbnail: true, images: true },
  });
  // Produto inexistente: sem título e sem indexação. Quem devolve o 404 é o
  // componente; aqui só não se anuncia um endereço que não existe.
  if (!product) return { robots: { index: false, follow: false } };

  const titulo = `${product.name} | ${organization.name}`;
  const descricao = descricaoCurta(
    product.description || `${product.name} na loja de ${organization.name}.`,
  );
  const canonical = storeCanonical(subdomain, `/${productSlug}`);
  // A thumbnail é key do R2; `images` já vem como URL. A primeira que resolver
  // para alguma coisa vira o cartão — produto sem foto fica sem imagem, em vez
  // de com uma URL quebrada.
  const imagem = constructUrl(product.thumbnail) || product.images[0] || "";

  return {
    title: titulo,
    description: descricao,
    robots: ROBOTS_VITRINE,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      siteName: organization.name,
      locale: "pt_BR",
      title: titulo,
      description: descricao,
      ...(canonical ? { url: canonical } : {}),
      ...(imagem ? { images: [{ url: imagem, alt: product.name }] } : {}),
    },
    twitter: {
      card: imagem ? "summary_large_image" : "summary",
      title: titulo,
      description: descricao,
      ...(imagem ? { images: [imagem] } : {}),
    },
  };
}

export default async function Page({ params }: ProductProps) {
  const { subdomain, productSlug } = await params;

  return <DetailsPoduct subdomain={subdomain} slug={productSlug} />;
}
