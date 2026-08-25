import type { Metadata } from "next";
import { CustomerOrderView } from "@/features/pedidos/customer/customer-order-view";

interface Props {
  params: Promise<{ orderId: string }>;
}

export const metadata: Metadata = {
  title: "Meu pedido",
};

// Rota pública para o cliente acompanhar o próprio pedido via QR code.
// Confiança vem do orderId (cuid) — mesmo modelo do painel TV.
export default async function PedidoClientePage({ params }: Props) {
  const { orderId } = await params;
  return <CustomerOrderView orderId={orderId} />;
}
