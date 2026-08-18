import {
  Circle,
  Document,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

export interface FloorPlanPdfObject {
  kind: "RECT" | "POINT" | "POLYGON" | "POLYLINE";
  x: number;
  y: number;
  width: number;
  height: number;
  points: number[]; // [x0,y0,x1,y1,...] em metros (POLYGON/POLYLINE)
  fill: string;
  stroke: string;
  label: string | null;
}

export interface FloorPlanPdfSpace {
  spaceCode: string | null;
  name: string | null;
  stateLabel: string;
  stateColor: string;
  occupant: string | null;
}

export interface FloorPlanPdfLegend {
  label: string;
  color: string;
}

export interface FloorPlanPdfData {
  planName: string;
  storeName: string;
  widthM: number;
  heightM: number;
  objects: FloorPlanPdfObject[];
  spaces: FloorPlanPdfSpace[];
  legend: FloorPlanPdfLegend[];
  generatedAt: string;
}

// A4 paisagem em pontos, menos margem. A planta ocupa a largura útil; a altura
// segue a proporção real da loja.
const PAGE_WIDTH = 842;
const MARGIN = 32;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const MAX_PLAN_HEIGHT = 360;

const styles = StyleSheet.create({
  page: { padding: MARGIN, fontSize: 9, color: "#0f172a" },
  title: { fontSize: 16, fontWeight: "bold" },
  subtitle: { fontSize: 10, color: "#64748b", marginBottom: 12 },
  planBox: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  legendRow: { flexDirection: "row", gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#cbd5e1",
    paddingBottom: 3,
    marginBottom: 3,
    fontWeight: "bold",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderColor: "#f1f5f9",
  },
  cellCode: { width: 130 },
  cellName: { flex: 1 },
  cellState: { width: 80 },
  cellOccupant: { width: 140 },
  footer: { marginTop: 12, fontSize: 8, color: "#94a3b8" },
});

export function FloorPlanDocument({ data }: { data: FloorPlanPdfData }) {
  const planScale = CONTENT_WIDTH / data.widthM;
  const planHeightPt = Math.min(data.heightM * planScale, MAX_PLAN_HEIGHT);
  const planWidthPt = CONTENT_WIDTH;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{data.planName}</Text>
        <Text style={styles.subtitle}>
          {data.storeName} · gerado em {data.generatedAt}
        </Text>

        <View
          style={[
            styles.planBox,
            { width: planWidthPt + 2, height: planHeightPt + 2 },
          ]}
        >
          <Svg
            width={planWidthPt}
            height={planHeightPt}
            viewBox={`0 0 ${data.widthM} ${data.heightM}`}
          >
            {data.objects.map((object, index) => {
              const strokeW = data.widthM / planWidthPt; // ~1px em tela
              if (object.kind === "RECT") {
                return (
                  <Rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de render
                    key={index}
                    x={object.x}
                    y={object.y}
                    width={object.width}
                    height={object.height}
                    fill={object.fill}
                    stroke={object.stroke}
                    strokeWidth={strokeW}
                  />
                );
              }
              if (object.kind === "POINT") {
                return (
                  <Circle
                    // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de render
                    key={index}
                    cx={object.x}
                    cy={object.y}
                    r={0.25}
                    fill={object.fill}
                    stroke={object.stroke}
                    strokeWidth={strokeW}
                  />
                );
              }
              const path = object.points.reduce((acc, value, position) => {
                if (position % 2 === 0) {
                  const command = position === 0 ? "M" : "L";
                  return `${acc} ${command} ${value}`;
                }
                return `${acc} ${value}`;
              }, "");
              const closedPath =
                object.kind === "POLYGON" ? `${path} Z` : path;
              return object.kind === "POLYGON" ? (
                <Path
                  // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de render
                  key={index}
                  d={closedPath}
                  fill={object.fill}
                  stroke={object.stroke}
                  strokeWidth={strokeW}
                />
              ) : (
                <Path
                  // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de render
                  key={index}
                  d={closedPath}
                  stroke={object.stroke}
                  strokeWidth={strokeW}
                />
              );
            })}
          </Svg>
        </View>

        <View style={styles.legendRow}>
          {data.legend.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: item.color }]}
              />
              <Text>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.cellCode}>ID do espaço</Text>
          <Text style={styles.cellName}>Nome</Text>
          <Text style={styles.cellState}>Estado</Text>
          <Text style={styles.cellOccupant}>Ocupante</Text>
        </View>
        {data.spaces.map((space, index) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de render
            key={index}
            style={styles.row}
            wrap={false}
          >
            <Text style={styles.cellCode}>{space.spaceCode ?? "—"}</Text>
            <Text style={styles.cellName}>{space.name ?? "—"}</Text>
            <Text style={[styles.cellState, { color: space.stateColor }]}>
              {space.stateLabel}
            </Text>
            <Text style={styles.cellOccupant}>{space.occupant ?? "—"}</Text>
          </View>
        ))}

        <Text style={styles.footer}>PDV Map · Órbita</Text>
      </Page>
    </Document>
  );
}
