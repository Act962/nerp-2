import { CustomerTicketView } from "@/features/pedidos/customer/customer-ticket-view";
import { ROBOTS_TELA_DE_APP } from "@/features/storefront/lib/seo";

export const metadata = {
  title: "Meu pedido",
  // O endereço é a credencial: o uuid do ticket veio impresso no cupom de quem
  // fez o pedido. Não é conteúdo para índice de busca.
  robots: ROBOTS_TELA_DE_APP,
};

export default async function Page({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  return <CustomerTicketView ticketId={ticketId} />;
}
