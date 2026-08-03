import L from "leaflet";
import { escapeHtml } from "@/lib/escape-html";

/**
 * O pino de um ponto de venda no mapa — um só construtor para todos.
 *
 * Importa `leaflet`, então só é alcançável através de uma fronteira
 * `dynamic(..., { ssr: false })`: o Leaflet mexe em `window` já na avaliação do
 * módulo.
 *
 * Cliente da carteira, varejo do diretório e ponto do OpenStreetMap usam a MESMA
 * geometria de propósito. O que um ponto do OSM é depois de virado cliente é o
 * que ele já era antes; mudar o desenho no meio do caminho fazia o pino parecer
 * quebrado. Quem distingue é a cor do anel — e o popup.
 */
export function createStorePin(params: {
  latitude: number;
  longitude: number;
  /** Já resolvida por `constructUrl`. Sem logo, o pino vira um ponto sólido. */
  logoUrl: string | null;
  ringColor: string;
}): L.Marker | L.CircleMarker {
  const { latitude, longitude, logoUrl, ringColor } = params;

  if (!logoUrl) {
    // Sem logo não há o que emoldurar: um `circleMarker` desenha no canvas
    // compartilhado em vez de criar um nó de DOM por pino.
    return L.circleMarker([latitude, longitude], {
      radius: 7,
      weight: 2,
      color: "#ffffff",
      fillColor: ringColor,
      fillOpacity: 1,
    });
  }

  return L.marker([latitude, longitude], {
    icon: L.divIcon({
      className: "",
      html: `<span style="display:block;width:34px;height:34px;border-radius:9999px;overflow:hidden;border:3px solid ${ringColor};box-shadow:0 1px 4px rgba(0,0,0,.4);background:#fff"><img src="${escapeHtml(logoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/></span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    }),
  });
}

/** Azul do "você está aqui", igual ao ponto do Google Maps. */
const MY_LOCATION_COLOR = "#1a73e8";

/**
 * O ponto azul de "você está aqui", com o halo de precisão em volta.
 *
 * São duas camadas porque significam coisas diferentes: o ponto é a posição
 * relatada, o halo é o raio de incerteza que o navegador informou. Dentro de um
 * supermercado esse raio passa fácil de 100 m — desenhar só o ponto afirmaria
 * uma precisão que não existe.
 */
export function createLocationMarkers(position: {
  latitude: number;
  longitude: number;
  accuracy: number;
}): L.Layer[] {
  const center: [number, number] = [position.latitude, position.longitude];

  const halo = L.circle(center, {
    radius: Math.max(position.accuracy, 10),
    color: MY_LOCATION_COLOR,
    weight: 1,
    opacity: 0.35,
    fillColor: MY_LOCATION_COLOR,
    fillOpacity: 0.12,
    interactive: false,
  });

  const dot = L.marker(center, {
    icon: L.divIcon({
      className: "",
      html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${MY_LOCATION_COLOR};border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.2),0 1px 4px rgba(0,0,0,.4)"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    // Fica acima dos pinos de loja: é referência de leitura, não um alvo.
    zIndexOffset: 1000,
    interactive: false,
  });

  return [halo, dot];
}
