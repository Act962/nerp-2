import type { Metadata } from "next";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { AboutUs } from "../../../../features/storefront/components/about-us";
import {
  descricaoCurta,
  ROBOTS_VITRINE,
  storeCanonical,
} from "@/features/storefront/lib/seo";
import prisma from "@/lib/db";
import { orpc } from "@/lib/orpc";

interface Props {
  params: Promise<{ subdomain: string }>;
}

/**
 * Título próprio para a página "sobre nós" da loja.
 *
 * Sem isto ela herdava o do layout e ficava idêntica ao catálogo e a todos os
 * produtos — o mesmo título repetido em cada endereço da loja.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;

  const org = await prisma.organization.findUnique({
    where: { subdomain },
    select: { name: true },
  });
  if (!org) return { robots: { index: false, follow: false } };

  const titulo = `Sobre nós | ${org.name}`;
  const descricao = descricaoCurta(
    `Quem somos, onde estamos e como falar com a ${org.name}.`,
  );
  const canonical = storeCanonical(subdomain, "/sobre-nos");

  return {
    title: titulo,
    description: descricao,
    robots: ROBOTS_VITRINE,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      siteName: org.name,
      locale: "pt_BR",
      title: titulo,
      description: descricao,
      ...(canonical ? { url: canonical } : {}),
    },
  };
}

export default async function Page({ params }: Props) {
  const queryClient = getQueryClient();
  const { subdomain } = await params;

  await queryClient.prefetchQuery(
    orpc.catalogSettings.public.queryOptions({
      input: {
        subdomain: subdomain,
      },
    }),
  );

  return (
    <HydrateClient client={queryClient}>
      <AboutUs subdomain={subdomain} />
    </HydrateClient>
  );
}
