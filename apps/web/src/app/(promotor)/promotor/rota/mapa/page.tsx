import { requireTradeAccess } from "@/features/billing/lib/require-trade-access";
import { RouteMapView } from "@/features/promoter-route/components/route-map-view";

// Página tela cheia — o mapa não convive com o rodapé da marca sem apertar as
// paradas; o header interno já traz o botão de voltar.
export default async function PromoterRouteMapPage() {
  await requireTradeAccess("promotor");
  return <RouteMapView />;
}
