import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { CoverBackground } from "../lib/cover-layout";
import type { BookVariableValues } from "../lib/book-variables";
import {
  CoverLayoutView,
  type PhotoBackdropSource,
  type PhotoSource,
  type ResolvedCoverElement,
} from "./cover-layout-view";

// Reexportados porque generate-book.tsx monta os dados a partir daqui — o
// renderizador de capa em si é compartilhado com o catálogo de PDV.
export type { PhotoBackdropSource, PhotoSource, ResolvedCoverElement };

export type PdvPhotoLayoutPattern =
  | "PATTERN_1"
  | "PATTERN_2"
  | "PATTERN_3"
  | "PATTERN_4";

export interface BookDocumentItem {
  // Layout próprio desta página; null cai no `pageLayout` do documento e,
  // faltando os dois, no layout fixo legado.
  pageLayout?: ResolvedCoverElement[] | null;
  pageBackground?: CoverBackground | null;
  storeName: string;
  storeManager: string | null;
  coordinatorName: string | null;
  consultantName: string | null;
  responsibleCompany: string | null;
  mediaTypeName: string | null;
  section: string | null;
  code: string | null;
  actionValueLabel: string | null;
  photoSources: PhotoSource[];
  photoBackdrops?: Array<PhotoBackdropSource | undefined>;
  photoLayoutPattern: PdvPhotoLayoutPattern | null;
}

export interface BookDocumentData {
  bookName: string;
  periodLabel: string;
  distributorLogoUrl: string | null;
  industryLogoUrl: string | null;
  industryName: string | null;
  brandLogoUrls: string[];
  items: BookDocumentItem[];
  coverLayout?: ResolvedCoverElement[] | null;
  closingLayout?: ResolvedCoverElement[] | null;
  // Layout livre das páginas de PDV. Vazio/null mantém o layout fixo abaixo.
  pageLayout?: ResolvedCoverElement[] | null;
  coverBackground?: CoverBackground | null;
  closingBackground?: CoverBackground | null;
  pageBackground?: CoverBackground | null;
}

// Variáveis que valem no documento inteiro — as únicas disponíveis na capa e
// na página final, que não têm PDV associado.
function buildBookVariables(data: BookDocumentData): BookVariableValues {
  return {
    nomeBook: data.bookName,
    periodo: data.periodLabel,
    industria: data.industryName,
  };
}

function buildItemVariables(
  data: BookDocumentData,
  item: BookDocumentItem,
  index: number,
): BookVariableValues {
  return {
    loja: item.storeName,
    gerente: item.storeManager,
    coordenador: item.coordinatorName,
    consultor: item.consultantName,
    empresaPdv: item.responsibleCompany,
    midia: item.mediaTypeName,
    secao: item.section,
    codigo: item.code,
    valorAcao: item.actionValueLabel,
    numeroPagina: `${index + 1} / ${data.items.length}`,
    nomeBook: data.bookName,
    periodo: data.periodLabel,
    industria: data.industryName,
  };
}

// 16:9 widescreen (mesma proporção do PPT do cliente): 960 x 540 pt.
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
    gap: 28,
  },
  coverLogo: { maxHeight: 130, maxWidth: 460, objectFit: "contain" },
  coverTitle: {
    fontSize: 34,
    fontWeight: "bold",
    textAlign: "center",
    color: INK,
    letterSpacing: 1,
  },
  coverRule: { width: 90, height: 4, backgroundColor: ACCENT, borderRadius: 2 },
  coverPeriod: {
    fontSize: 18,
    color: ACCENT,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  coverIndustryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
  },
  coverIndustryLogo: { maxHeight: 44, maxWidth: 160, objectFit: "contain" },
  coverIndustryName: { fontSize: 13, color: MUTED },

  page: { flexDirection: "column", height: "100%" },
  headerBand: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    textTransform: "uppercase",
    flex: 1,
    paddingRight: 16,
  },
  headerPeriod: {
    fontSize: 11,
    color: "#ffffff",
    opacity: 0.9,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  body: { flexDirection: "row", flex: 1, padding: 20, gap: 18 },

  meta: { width: 210, flexDirection: "column", gap: 10 },
  metaItem: { flexDirection: "column", gap: 2 },
  metaLabel: {
    fontSize: 8,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaValue: { fontSize: 12, color: INK, fontWeight: "bold" },
  valueBox: {
    marginTop: 4,
    backgroundColor: "#fef2f2",
    borderLeft: `3 solid ${ACCENT}`,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 3,
  },
  valueLabel: {
    fontSize: 8,
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  valueAmount: { fontSize: 18, color: ACCENT, fontWeight: "bold" },

  photos: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoFull: { width: "100%", height: "100%", objectFit: "cover" },
  photoHalf: {
    width: "48.5%",
    height: "100%",
    objectFit: "cover",
    borderRadius: 4,
  },
  photoGrid: {
    width: "48.5%",
    height: "48.5%",
    objectFit: "cover",
    borderRadius: 4,
  },
  photoColumn: { flex: 1, flexDirection: "column", gap: 10 },
  photoColumnItem: {
    flex: 1,
    width: "100%",
    objectFit: "cover",
    borderRadius: 4,
  },
  photoStackedFull: {
    width: "100%",
    height: "48.5%",
    objectFit: "cover",
    borderRadius: 4,
  },
  photoFullWrap: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
    overflow: "hidden",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderTop: "1 solid #e5e7eb",
  },
  footerBrands: { flexDirection: "row", alignItems: "center", gap: 14 },
  brandLogo: { height: 24, maxWidth: 90, objectFit: "contain" },
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

function MetaItem({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function PhotoLayout({
  sources,
  pattern,
}: {
  sources: PhotoSource[];
  pattern: PdvPhotoLayoutPattern | null;
}) {
  const photos = sources.slice(0, 4);
  if (photos.length === 0) {
    return null;
  }

  // Padrão 1: 1 vertical à esquerda + 2 horizontais empilhadas à direita.
  if (pattern === "PATTERN_1" && photos.length === 3) {
    return (
      <View style={styles.photos}>
        <Image src={photos[0]} style={styles.photoHalf} />
        <View style={styles.photoColumn}>
          <Image src={photos[1]} style={styles.photoColumnItem} />
          <Image src={photos[2]} style={styles.photoColumnItem} />
        </View>
      </View>
    );
  }

  // Padrão 2: 2 horizontais empilhadas à esquerda + 1 vertical à direita.
  if (pattern === "PATTERN_2" && photos.length === 3) {
    return (
      <View style={styles.photos}>
        <View style={styles.photoColumn}>
          <Image src={photos[0]} style={styles.photoColumnItem} />
          <Image src={photos[1]} style={styles.photoColumnItem} />
        </View>
        <Image src={photos[2]} style={styles.photoHalf} />
      </View>
    );
  }

  // Padrão 4: 2 horizontais empilhadas. (Padrão 3 = 2 verticais lado a
  // lado, que já é o comportamento padrão de 2 fotos abaixo.)
  if (pattern === "PATTERN_4" && photos.length === 2) {
    return (
      <View style={[styles.photos, { flexDirection: "column" }]}>
        <Image src={photos[0]} style={styles.photoStackedFull} />
        <Image src={photos[1]} style={styles.photoStackedFull} />
      </View>
    );
  }

  if (photos.length === 1) {
    return (
      <View style={styles.photos}>
        <View style={styles.photoFullWrap}>
          <Image src={photos[0]} style={styles.photoFull} />
        </View>
      </View>
    );
  }
  if (photos.length === 2) {
    return (
      <View style={styles.photos}>
        {photos.map((source, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: ordem fixa, sem reordenação
          <Image key={index} src={source} style={styles.photoHalf} />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.photos}>
      {photos.map((source, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: ordem fixa, sem reordenação
        <Image key={index} src={source} style={styles.photoGrid} />
      ))}
    </View>
  );
}

export function BookDocument({ data }: { data: BookDocumentData }) {
  return (
    <Document title={data.bookName}>
      <Page size={PAGE_SIZE}>
        {data.coverLayout && data.coverLayout.length > 0 ? (
          <CoverLayoutView
            elements={data.coverLayout}
            background={data.coverBackground}
            variableValues={buildBookVariables(data)}
          />
        ) : (
          <View style={styles.cover}>
            {data.distributorLogoUrl && (
              <Image src={data.distributorLogoUrl} style={styles.coverLogo} />
            )}
            <Text style={styles.coverTitle}>{data.bookName}</Text>
            <View style={styles.coverRule} />
            <Text style={styles.coverPeriod}>{data.periodLabel}</Text>
            {data.industryName && (
              <View style={styles.coverIndustryRow}>
                {data.industryLogoUrl && (
                  <Image
                    src={data.industryLogoUrl}
                    style={styles.coverIndustryLogo}
                  />
                )}
                <Text style={styles.coverIndustryName}>
                  {data.industryName}
                </Text>
              </View>
            )}
          </View>
        )}
      </Page>

      {data.items.map((item, index) => {
        // Layout da página vence o do book; sem nenhum dos dois, layout fixo.
        const layout =
          item.pageLayout && item.pageLayout.length > 0
            ? item.pageLayout
            : data.pageLayout;
        const layoutBackground = item.pageLayout
          ? item.pageBackground
          : data.pageBackground;

        return layout && layout.length > 0 ? (
          <Page key={`${item.storeName}-${index}`} size={PAGE_SIZE}>
            <CoverLayoutView
              elements={layout}
              background={layoutBackground}
              variableValues={buildItemVariables(data, item, index)}
              photoSources={item.photoSources}
              photoBackdrops={item.photoBackdrops}
            />
          </Page>
        ) : (
          <Page key={`${item.storeName}-${index}`} size={PAGE_SIZE}>
            <View style={styles.page}>
              <View style={styles.headerBand}>
                <Text style={styles.headerTitle}>{item.storeName}</Text>
                <Text style={styles.headerPeriod}>{data.periodLabel}</Text>
              </View>

              <View style={styles.body}>
                <View style={styles.meta}>
                  <MetaItem label="Gerente" value={item.storeManager} />
                  <MetaItem
                    label="Coordenador(a)"
                    value={item.coordinatorName}
                  />
                  <MetaItem label="Consultor(a)" value={item.consultantName} />
                  <MetaItem
                    label="Empresa PDV"
                    value={item.responsibleCompany}
                  />
                  <MetaItem label="Mídia" value={item.mediaTypeName} />
                  <MetaItem label="Seção" value={item.section} />
                  <MetaItem label="Código" value={item.code} />
                  {item.actionValueLabel && (
                    <View style={styles.valueBox}>
                      <Text style={styles.valueLabel}>Valor da ação</Text>
                      <Text style={styles.valueAmount}>
                        {item.actionValueLabel}
                      </Text>
                    </View>
                  )}
                </View>

                <PhotoLayout
                  sources={item.photoSources}
                  pattern={item.photoLayoutPattern}
                />
              </View>

              <View style={styles.footer}>
                <View style={styles.footerBrands}>
                  {data.brandLogoUrls.map((url, logoIndex) => (
                    <Image
                      key={`${url}-${logoIndex}`}
                      src={url}
                      style={styles.brandLogo}
                    />
                  ))}
                </View>
                <Text style={styles.footerPage}>
                  {index + 1} / {data.items.length}
                </Text>
              </View>
            </View>
          </Page>
        );
      })}

      <Page size={PAGE_SIZE}>
        {data.closingLayout && data.closingLayout.length > 0 ? (
          <CoverLayoutView
            elements={data.closingLayout}
            background={data.closingBackground}
            variableValues={buildBookVariables(data)}
          />
        ) : (
          <View style={styles.closing}>
            {data.distributorLogoUrl && (
              <Image src={data.distributorLogoUrl} style={styles.coverLogo} />
            )}
            <Text style={styles.closingText}>Obrigado!</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
