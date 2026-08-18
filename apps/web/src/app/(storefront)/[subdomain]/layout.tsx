import prisma from "@/lib/db";
import { Header } from "../../../features/storefront/components/header";
import { notFound } from "next/navigation";
import { Footer } from "../../../features/storefront/components/footer";
import type { Metadata } from "next";
import { useConstructUrl } from "@/hooks/use-construct-url";
import { headers } from "next/headers";
import { CatalogBaseProvider } from "@/features/storefront/lib/catalog-base";

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

export async function generateMetadata({
  params,
}: StoreFrontLayoutProps): Promise<Metadata> {
  const { subdomain } = await params;

  const org = await getOrganization(subdomain);

  if (!org) {
    return {
      title: "Organização não encontrada",
    };
  }

  const { catalogSettings } = org;

  return {
    title: catalogSettings?.metaTitle || org.name,
    description: catalogSettings?.metaDescription || org.name,
    icons: catalogSettings?.logo
      ? [{ url: useConstructUrl(catalogSettings.logo), type: "image/png" }]
      : [],
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
