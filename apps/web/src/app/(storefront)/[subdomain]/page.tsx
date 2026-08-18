import { Catalog } from "../../../features/storefront/components/catalog";

interface StoreFrontLayoutProps {
  params: Promise<{ subdomain: string }>;
}

export default async function Page({ params }: StoreFrontLayoutProps) {
  const { subdomain } = await params;

  return <Catalog subdomain={subdomain} />;
}
