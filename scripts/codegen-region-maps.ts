// One-off: gera os arquivos estáticos de path SVG usados pelo MapWidget
// (src/features/dashboard-widgets/components/widgets/map-widget.tsx), a
// partir de GeoJSON público. Roda uma vez com `npx tsx scripts/codegen-region-maps.ts`;
// os arquivos gerados ficam versionados, este script não roda em runtime.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const PIAUI_MUNICIPIOS_URL =
  "https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-22-mun.json";
const BRAZIL_STATES_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

const VIEWBOX_SIZE = 1000;

type Ring = [number, number][];
type GeoFeature = {
  properties: Record<string, unknown>;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
};
type GeoCollection = { features: GeoFeature[] };

interface PathEntry {
  id: string;
  name: string;
  d: string;
}

// Extrai todos os anéis (exterior + buracos) de uma feature, achatando
// Polygon/MultiPolygon pro mesmo shape — o `d` final usa fill-rule evenodd,
// então não precisa saber qual anel é buraco.
function ringsOf(geometry: GeoFeature["geometry"]): Ring[] {
  if (geometry.type === "Polygon") {
    return geometry.coordinates as Ring[];
  }
  return (geometry.coordinates as Ring[][]).flat();
}

// Decimação simples (mantém 1 a cada `stride` pontos) — sem lib de
// simplificação geométrica (Douglas-Peucker etc.), suficiente pra um
// choropleth em card de dashboard, não pra precisão cartográfica. Preserva
// anéis pequenos (ilhas/exclaves) intactos pra não sumir com eles.
function decimate(ring: Ring, stride: number): Ring {
  if (stride <= 1 || ring.length <= 12) return ring;
  const kept = ring.filter((_, index) => index % stride === 0);
  const first = ring[0];
  const last = kept[kept.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    kept.push(first);
  }
  return kept;
}

function buildProjection(features: GeoFeature[]) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const feature of features) {
    for (const ring of ringsOf(feature.geometry)) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  const avgLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const correction = Math.cos(avgLatRad);
  const lngSpanCorrected = (maxLng - minLng) * correction;
  const scale = VIEWBOX_SIZE / lngSpanCorrected;
  const height = (maxLat - minLat) * scale;

  function project([lng, lat]: [number, number]): [number, number] {
    const x = (lng - minLng) * correction * scale;
    const y = (maxLat - lat) * scale;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  return { project, viewBox: `0 0 ${VIEWBOX_SIZE} ${Math.round(height)}` };
}

function ringToPathSegment(
  ring: Ring,
  project: (p: [number, number]) => [number, number],
): string {
  const points = ring.map(project);
  const [firstX, firstY] = points[0];
  const rest = points
    .slice(1)
    .map(([x, y]) => `L${x},${y}`)
    .join("");
  return `M${firstX},${firstY}${rest}Z`;
}

async function codegenMap(options: {
  url: string;
  outFile: string;
  exportPrefix: string;
  stride: number;
  idOf: (feature: GeoFeature) => string;
  nameOf: (feature: GeoFeature) => string;
}): Promise<void> {
  const response = await fetch(options.url);
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${options.url}: ${response.status}`);
  }
  const collection = (await response.json()) as GeoCollection;
  const { project, viewBox } = buildProjection(collection.features);

  const entries: PathEntry[] = collection.features.map((feature) => {
    const rings = ringsOf(feature.geometry).map((ring) =>
      decimate(ring, options.stride),
    );
    const d = rings.map((ring) => ringToPathSegment(ring, project)).join(" ");
    return { id: options.idOf(feature), name: options.nameOf(feature), d };
  });

  const content = `// Gerado por scripts/codegen-region-maps.ts — não editar à mão.
// Fonte: ${options.url}
export const ${options.exportPrefix}_VIEW_BOX = ${JSON.stringify(viewBox)};

export const ${options.exportPrefix}_PATHS: { id: string; name: string; d: string }[] = ${JSON.stringify(
    entries,
    null,
    0,
  )};
`;
  const outPath = join(process.cwd(), options.outFile);
  writeFileSync(outPath, content);
  const sizeKb = (Buffer.byteLength(content) / 1024).toFixed(1);
  console.log(`${options.outFile}: ${entries.length} regiões, ${sizeKb} KB`);
}

async function main() {
  await codegenMap({
    url: BRAZIL_STATES_URL,
    outFile: "src/features/dashboard-widgets/lib/geo/brazil-states.paths.ts",
    exportPrefix: "BRAZIL_STATES",
    stride: 5,
    idOf: (f) => String(f.properties.sigla),
    nameOf: (f) => String(f.properties.name),
  });

  await codegenMap({
    url: PIAUI_MUNICIPIOS_URL,
    outFile: "src/features/dashboard-widgets/lib/geo/piaui-municipios.paths.ts",
    exportPrefix: "PIAUI_MUNICIPIOS",
    stride: 2,
    idOf: (f) => String(f.properties.name),
    nameOf: (f) => String(f.properties.name),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
