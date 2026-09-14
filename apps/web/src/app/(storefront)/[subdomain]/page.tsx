import prisma from "@/lib/db";
import { Catalog } from "../../../features/storefront/components/catalog";
import { MenuView } from "../../../features/storefront/components/cardapio/menu-view";

interface StoreFrontLayoutProps {
  params: Promise<{ subdomain: string }>;
}

export default async function Page({ params }: StoreFrontLayoutProps) {
  const { subdomain } = await params;

  // O leiaute é decidido no servidor para o cardápio não piscar como vitrine
  // antes de a configuração chegar — quem abre pelo Instagram julga a loja no
  // primeiro segundo.
  const organization = await prisma.organization.findUnique({
    where: { subdomain },
    select: { catalogSettings: { select: { layout: true } } },
  });

  if (organization?.catalogSettings?.layout === "CARDAPIO") {
    return <MenuView subdomain={subdomain} />;
  }

  return <Catalog subdomain={subdomain} />;
}
