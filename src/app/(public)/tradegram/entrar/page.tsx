import { ShopperAuth } from "@/features/shopper/components/shopper-auth";
import { Suspense } from "react";

interface Props {
  searchParams: Promise<{ redirect?: string }>;
}

// Login/cadastro do cliente final (global, cross-loja).
export default async function ShopperEntrarPage({ searchParams }: Props) {
  const { redirect } = await searchParams;
  return (
    <Suspense>
      <ShopperAuth redirectTo={redirect} />
    </Suspense>
  );
}
