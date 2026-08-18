import { Cart } from "../../../../features/storefront/components/cart";

interface CardProps {
  params: Promise<{ subdomain: string }>;
}

export default async function Page({ params }: CardProps) {
  const { subdomain } = await params;

  return <Cart subdomain={subdomain} />;
}
