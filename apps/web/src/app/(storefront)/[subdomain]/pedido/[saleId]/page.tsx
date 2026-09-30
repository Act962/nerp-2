import type { Metadata } from "next";
import { AcompanharPedido } from "@/features/storefront/components/acompanhar-pedido";

export const metadata: Metadata = {
  title: "Acompanhar pedido",
  // O link é do cliente: não pode cair em buscador.
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ subdomain: string; saleId: string }>;
}) {
  const { subdomain, saleId } = await params;
  return <AcompanharPedido subdomain={subdomain} saleId={saleId} />;
}
