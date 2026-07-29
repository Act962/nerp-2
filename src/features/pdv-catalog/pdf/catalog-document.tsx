import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { CoverBackground } from "@/features/books/lib/cover-layout";
import {
  CoverLayoutView,
  type ResolvedCoverElement,
} from "@/features/books/pdf/cover-layout-view";

export type { ResolvedCoverElement };

export interface CatalogDocumentRow {
  storeName: string;
  quantity: number;
  priceLabel: string | null;
  status: string;
}

export interface CatalogDocumentPage {
  title: string;
  photoUrls: string[];
  rows: CatalogDocumentRow[];
}

export interface CatalogDocumentData {
  catalogName: string;
  showIndex: boolean;
  pages: CatalogDocumentPage[];
  coverLayout?: ResolvedCoverElement[] | null;
  closingLayout?: ResolvedCoverElement[] | null;
  coverBackground?: CoverBackground | null;
  closingBackground?: CoverBackground | null;
}

// 16:9 widescreen, mesmo canvas do editor Konva (960x540) — coordenadas dos
// elementos de capa valem direto no PDF, sem conversão.
const PAGE_SIZE: [number, number] = [960, 540];
const ACCENT = "#c1121f";
const INK = "#1a1a1a";
const MUTED = "#6b7280";

const styles = StyleSheet.create({
  cover: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: 64,
    gap: 24,
  },
  coverTitle: {
    fontSize: 34,
    fontWeight: "bold",
    textAlign: "center",
    color: INK,
    letterSpacing: 1,
  },
  coverRule: { width: 90, height: 4, backgroundColor: ACCENT, borderRadius: 2 },
  coverSubtitle: {
    fontSize: 14,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 2,
  },

  indexPage: { flexDirection: "column", height: "100%", padding: 48 },
  indexTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: INK,
    marginBottom: 24,
  },
  indexRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 8,
    borderBottom: "1 solid #e5e7eb",
  },
  indexRowTitle: { fontSize: 13, color: INK },
  indexRowPage: { fontSize: 13, color: MUTED },

  page: { flexDirection: "column", height: "100%" },
  headerBand: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
  },

  body: { flex: 1, flexDirection: "column", padding: 24, gap: 16 },

  photos: { flexDirection: "row", gap: 10, height: 200 },
  // contain para a foto sair no PDF com o mesmo enquadramento que foi salvo —
  // cover cortava as bordas do espaço fotografado.
  photo: { flex: 1, objectFit: "contain", borderRadius: 4 },

  table: { flexDirection: "column", flex: 1 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: `2 solid ${ACCENT}`,
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottom: "1 solid #e5e7eb",
    alignItems: "center",
  },
  colStore: { flex: 2, fontSize: 11, color: INK },
  colQuantity: { flex: 1, fontSize: 11, color: INK, textAlign: "center" },
  colPrice: { flex: 1, fontSize: 12, color: ACCENT, fontWeight: "bold" },
  colStatus: {
    flex: 1,
    fontSize: 10,
    color: MUTED,
    textTransform: "uppercase",
  },
  headCell: {
    fontSize: 9,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderTop: "1 solid #e5e7eb",
  },
  footerPage: { fontSize: 9, color: MUTED },

  closing: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 20,
  },
  closingText: { fontSize: 30, fontWeight: "bold", color: ACCENT },
});

function CatalogPagePhotos({ urls }: { urls: string[] }) {
  const photos = urls.slice(0, 3);
  if (photos.length === 0) return null;
  return (
    <View style={styles.photos}>
      {photos.map((url, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ordem fixa, sem reordenação
        <Image key={index} src={url} style={styles.photo} />
      ))}
    </View>
  );
}

function CatalogPageTable({ rows }: { rows: CatalogDocumentRow[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.headCell, { flex: 2 }]}>Loja</Text>
        <Text style={[styles.headCell, { flex: 1, textAlign: "center" }]}>
          Qtd.
        </Text>
        <Text style={[styles.headCell, { flex: 1 }]}>Preço/mês</Text>
        <Text style={[styles.headCell, { flex: 1 }]}>Status</Text>
      </View>
      {rows.map((row, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ordem fixa, sem reordenação
        <View key={index} style={styles.tableRow}>
          <Text style={styles.colStore}>{row.storeName}</Text>
          <Text style={styles.colQuantity}>{row.quantity}</Text>
          <Text style={styles.colPrice}>{row.priceLabel ?? "—"}</Text>
          <Text style={styles.colStatus}>{row.status}</Text>
        </View>
      ))}
    </View>
  );
}

export function CatalogDocument({ data }: { data: CatalogDocumentData }) {
  return (
    <Document title={data.catalogName}>
      <Page size={PAGE_SIZE}>
        {data.coverLayout && data.coverLayout.length > 0 ? (
          <CoverLayoutView
            elements={data.coverLayout}
            background={data.coverBackground}
          />
        ) : (
          <View style={styles.cover}>
            <Text style={styles.coverTitle}>{data.catalogName}</Text>
            <View style={styles.coverRule} />
            <Text style={styles.coverSubtitle}>Oportunidades de PDV</Text>
          </View>
        )}
      </Page>

      {data.showIndex && data.pages.length > 0 && (
        <Page size={PAGE_SIZE}>
          <View style={styles.indexPage}>
            <Text style={styles.indexTitle}>Índice</Text>
            {data.pages.map((page, index) => (
              <View key={`${page.title}-${index}`} style={styles.indexRow}>
                <Text style={styles.indexRowTitle}>{page.title}</Text>
                <Text style={styles.indexRowPage}>{index + 1}</Text>
              </View>
            ))}
          </View>
        </Page>
      )}

      {data.pages.map((page, index) => (
        <Page key={`${page.title}-${index}`} size={PAGE_SIZE}>
          <View style={styles.page}>
            <View style={styles.headerBand}>
              <Text style={styles.headerTitle}>{page.title}</Text>
            </View>

            <View style={styles.body}>
              <CatalogPagePhotos urls={page.photoUrls} />
              <CatalogPageTable rows={page.rows} />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerPage}>
                {index + 1} / {data.pages.length}
              </Text>
            </View>
          </View>
        </Page>
      ))}

      <Page size={PAGE_SIZE}>
        {data.closingLayout && data.closingLayout.length > 0 ? (
          <CoverLayoutView
            elements={data.closingLayout}
            background={data.closingBackground}
          />
        ) : (
          <View style={styles.closing}>
            <Text style={styles.closingText}>Obrigado!</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
