import { DetailsPoduct } from "@/features/storefront/components/details-product";

interface ProductProps {
  params: Promise<{
    subdomain: string;
    productSlug: string;
  }>;
}

export default async function Page({ params }: ProductProps) {
  const { subdomain, productSlug } = await params;

  return <DetailsPoduct subdomain={subdomain} slug={productSlug} />;
}
