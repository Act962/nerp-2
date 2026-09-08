import prisma from "@/lib/db";
import { Header } from "../../../features/storefront/components/header";
import { notFound } from "next/navigation";
import { Footer } from "../../../features/storefront/components/footer";
import type { Metadata } from "next";
// `constructUrl` e não `useConstructUrl`: as duas são a MESMA função (o "hook"
// só a repassa), mas aqui estamos em `generateMetadata`, que não é componente.
// Chamar algo com nome de hook fora de um componente — e ainda dentro de um
// ternário — é erro de lint, e é erro de leitura também.
import { constructUrl } from "@/hooks/use-construct-url";
import { headers } from "next/headers";
import { CatalogBaseProvider } from "@/features/storefront/lib/catalog-base";
import {
  descricaoCurta,
  ROBOTS_VITRINE,
  storeCanonical,
} from "@/features/storefront/lib/seo";

interface StoreFrontLayoutProps {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}

async function getOrganization(subdomain: string) {
  const org = await prisma.organization.findUnique({
    where: { subdomain },
    include: {
      catalogSettings: true,
    },
  });

  return org;
}

/**
 * O metadata da vitrine.
 *
 * A raiz do app é `noindex` (ver `src/app/layout.tsx`) porque quase tudo aqui
 * é tela de sistema. A loja é a exceção: é comércio, é público e o cliente
 * quer ser achado. Por isso é aqui que a indexação é ligada de volta — e por
 * isso o `robots` aparece explicitamente, em vez de ficar subentendido.
 *
 * As telas de app do subtree (carrinho, checkout, conta, login) desligam de
 * novo, cada uma no próprio arquivo: o `robots` do segmento mais profundo
 * ganha do de cima.
 */
export async function generateMetadata({
  params,
}: StoreFrontLayoutProps): Promise<Metadata> {
  const { subdomain } = await params;

  const org = await getOrganization(subdomain);

  if (!org) {
    // Loja inexistente é 404 no `SubdomainLayout` logo abaixo. Metadata de
    // uma página que não existe não deve ser indexável — sem isto o endereço
    // errado entra no índice com um título bonito.
    return {
      title: "Organização não encontrada",
      robots: { index: false, follow: false },
    };
  }

  const { catalogSettings } = org;

  const titulo = catalogSettings?.metaTitle || org.name;
  const descricao = descricaoCurta(
    catalogSettings?.metaDescription ||
      `Catálogo e loja on-line de ${org.name}.`,
  );
  const canonical = storeCanonical(subdomain, "/");
  const logo = constructUrl(catalogSettings?.logo ?? "");

  return {
    title: titulo,
    description: descricao,
    robots: ROBOTS_VITRINE,
    // O mesmo catálogo responde em `loja.dominio.com` e em
    // `dominio.com/catalogo/<slug>`; sem canonical isso é conteúdo duplicado.
    // Ver `features/storefront/lib/seo.ts`.
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      siteName: org.name,
      locale: "pt_BR",
      title: titulo,
      description: descricao,
      ...(canonical ? { url: canonical } : {}),
      ...(logo ? { images: [{ url: logo, alt: org.name }] } : {}),
    },
    twitter: {
      // `summary` e não `summary_large_image`: a logo da loja é quadrada e
      // pequena; num cartão largo ela apareceria esticada ou cortada.
      card: "summary",
      title: titulo,
      description: descricao,
      ...(logo ? { images: [logo] } : {}),
    },
    icons: logo ? [{ url: logo, type: "image/png" }] : [],
  };
}

export default async function SubdomainLayout({
  children,
  params,
}: StoreFrontLayoutProps) {
  const { subdomain } = await params;

  const org = await getOrganization(subdomain);

  if (!org) {
    notFound();
  }

  if (!org.catalogSettings) {
    notFound();
  }

  const settings = org.catalogSettings;

  // Modo caminho (/catalogo/{slug}/...) coloca "/catalogo/{slug}" no header
  // via middleware; modo subdomínio deixa vazio (hostname resolve o tenant).
  const hdrs = await headers();
  const catalogBase = hdrs.get("x-catalog-base") ?? "";

  return (
    <CatalogBaseProvider base={catalogBase}>
      <div className="bg-accent-foreground/5 min-h-screen flex flex-col">
        <Header
          settings={{
            subdomain,
            metaTitle: settings.metaTitle,
            theme: settings.theme,
            organizationId: org.id,
            bannerImage: settings.logo,
            allowOrders: settings.allowOrders,
          }}
        />
        <main className="mt-15 sm:mt-19 flex-1">{children}</main>
        <Footer
          settings={{
            theme: settings.theme,
            address: settings.address,
            cep: settings.cep,
            paymentMethodSettings: settings.paymentMethodSettings,
            deliveryMethods: settings.deliveryMethods,
            whatsappNumber: settings.whatsappNumber,
            showWhatsapp: settings.showWhatsapp,
            contactEmail: settings.contactEmail,
            district: settings.district,
            number: settings.number,
            instagram: settings.instagram,
            facebook: settings.facebook,
            twitter: settings.twitter,
            tiktok: settings.tiktok,
            youtube: settings.youtube,
            kwai: settings.kwai,
            deliverySpecialInfo: settings.deliverySpecialInfo,
          }}
        />
      </div>
    </CatalogBaseProvider>
  );
}
