import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { generateTradeCatalogPagesFor } from "@/features/pdv-catalog/server/generate-pages";
import prisma from "@/lib/db";
import sharp from "sharp";

// Gera uma imagem própria para CADA tipo de mídia do Cadastros de Trade e sobe
// para o R2. Motivo: as chaves reaproveitadas do banco Neon apontam para outro
// bucket e voltam 404 aqui — o catálogo ficava com fotos quebradas. Imagens
// geradas também evitam usar material de terceiros num catálogo comercial.

const ORG_SLUG = "gotham";
const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
const PUBLIC_HOST = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;

if (!BUCKET || !PUBLIC_HOST) {
  throw new Error(
    "Faltam NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES / NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL.",
  );
}

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: false,
});

// Glifo por família de mídia: o desenho muda conforme o que a mídia é de fato,
// então cada página do catálogo fica visualmente distinta.
type Glyph =
  | "shelf"
  | "endcap"
  | "island"
  | "checkout"
  | "cooler"
  | "pallet"
  | "hanging"
  | "floor"
  | "wall"
  | "totem"
  | "screen"
  | "phone"
  | "signal";

const GLYPH_BY_CODE: Record<string, Glyph> = {
  PG: "endcap",
  GO: "shelf",
  TG: "endcap",
  FG: "shelf",
  IL: "island",
  ST: "island",
  CM: "shelf",
  CK: "checkout",
  EN: "checkout",
  SD: "checkout",
  FR: "cooler",
  GL: "cooler",
  AC: "cooler",
  PA: "shelf",
  HF: "island",
  AG: "shelf",
  DP: "island",
  PL: "pallet",
  SP: "shelf",
  WB: "hanging",
  MB: "hanging",
  CS: "hanging",
  BN: "wall",
  AD: "wall",
  PI: "wall",
  FC: "wall",
  AP: "floor",
  ET: "floor",
  CR: "pallet",
  CE: "pallet",
  TT: "totem",
  TD: "totem",
  TV: "screen",
  LED: "screen",
  MAP: "screen",
  ED: "screen",
  QR: "phone",
  APP: "phone",
  WA: "phone",
  PN: "phone",
  CP: "phone",
  CB: "phone",
  FD: "phone",
  GEO: "signal",
  RI: "signal",
  RM: "signal",
};

const PALETTE_FISICA = [
  ["#0f172a", "#1e3a8a"],
  ["#1c1917", "#7c2d12"],
  ["#052e16", "#166534"],
  ["#1e1b4b", "#4338ca"],
  ["#0c0a09", "#3f3f46"],
];
const PALETTE_DIGITAL = [
  ["#0b1120", "#0e7490"],
  ["#1e1b4b", "#7e22ce"],
  ["#082f49", "#0369a1"],
  ["#0f172a", "#1d4ed8"],
];

function drawGlyph(glyph: Glyph): string {
  // Desenhos simples em coordenadas 0..400, centralizados pelo <g> do caller.
  switch (glyph) {
    case "shelf":
      return `<rect x="40" y="80" width="320" height="16" rx="4"/><rect x="40" y="170" width="320" height="16" rx="4"/><rect x="40" y="260" width="320" height="16" rx="4"/>
        <rect x="70" y="30" width="46" height="50" rx="6" opacity=".75"/><rect x="130" y="34" width="46" height="46" rx="6" opacity=".55"/><rect x="190" y="28" width="46" height="52" rx="6" opacity=".7"/>
        <rect x="70" y="120" width="46" height="50" rx="6" opacity=".6"/><rect x="130" y="124" width="46" height="46" rx="6" opacity=".8"/>`;
    case "endcap":
      return `<path d="M110 300 L110 90 Q110 60 200 60 Q290 60 290 90 L290 300 Z" opacity=".85"/>
        <rect x="120" y="120" width="160" height="14" rx="4" fill="#fff" opacity=".5"/>
        <rect x="120" y="180" width="160" height="14" rx="4" fill="#fff" opacity=".5"/>
        <rect x="120" y="240" width="160" height="14" rx="4" fill="#fff" opacity=".5"/>`;
    case "island":
      return `<ellipse cx="200" cy="250" rx="150" ry="46" opacity=".8"/>
        <rect x="120" y="130" width="160" height="120" rx="10" opacity=".9"/>
        <rect x="150" y="90" width="100" height="46" rx="8" opacity=".6"/>`;
    case "checkout":
      return `<rect x="50" y="180" width="300" height="60" rx="10" opacity=".9"/>
        <rect x="80" y="120" width="90" height="60" rx="8" opacity=".7"/>
        <rect x="250" y="90" width="70" height="90" rx="8" opacity=".8"/>
        <circle cx="120" cy="270" r="18" opacity=".6"/><circle cx="280" cy="270" r="18" opacity=".6"/>`;
    case "cooler":
      return `<rect x="90" y="50" width="220" height="260" rx="14" opacity=".9"/>
        <rect x="110" y="70" width="80" height="220" rx="8" fill="#fff" opacity=".25"/>
        <rect x="210" y="70" width="80" height="220" rx="8" fill="#fff" opacity=".18"/>
        <rect x="186" y="140" width="10" height="70" rx="5" fill="#fff" opacity=".7"/>`;
    case "pallet":
      return `<rect x="60" y="250" width="280" height="24" rx="4" opacity=".9"/>
        <rect x="60" y="286" width="280" height="18" rx="4" opacity=".6"/>
        <rect x="100" y="130" width="90" height="120" rx="6" opacity=".85"/>
        <rect x="205" y="100" width="90" height="150" rx="6" opacity=".7"/>`;
    case "hanging":
      return `<rect x="30" y="40" width="340" height="10" rx="5" opacity=".7"/>
        <line x1="130" y1="50" x2="130" y2="120" stroke="currentColor" stroke-width="4" opacity=".6"/>
        <line x1="270" y1="50" x2="270" y2="150" stroke="currentColor" stroke-width="4" opacity=".6"/>
        <rect x="80" y="120" width="100" height="80" rx="10" opacity=".9"/>
        <circle cx="270" cy="200" r="50" opacity=".8"/>`;
    case "floor":
      return `<path d="M60 300 L140 150 L260 150 L340 300 Z" opacity=".85"/>
        <circle cx="200" cy="225" r="46" fill="#fff" opacity=".35"/>
        <rect x="150" y="90" width="100" height="14" rx="7" opacity=".5"/>`;
    case "wall":
      return `<rect x="50" y="60" width="300" height="200" rx="10" opacity=".9"/>
        <rect x="78" y="90" width="180" height="18" rx="6" fill="#fff" opacity=".5"/>
        <rect x="78" y="126" width="130" height="14" rx="6" fill="#fff" opacity=".35"/>
        <rect x="78" y="170" width="244" height="60" rx="8" fill="#fff" opacity=".2"/>`;
    case "totem":
      return `<rect x="140" y="40" width="120" height="230" rx="14" opacity=".9"/>
        <rect x="158" y="60" width="84" height="170" rx="8" fill="#fff" opacity=".3"/>
        <rect x="110" y="278" width="180" height="20" rx="8" opacity=".7"/>`;
    case "screen":
      return `<rect x="50" y="60" width="300" height="180" rx="12" opacity=".9"/>
        <rect x="70" y="80" width="260" height="140" rx="6" fill="#fff" opacity=".28"/>
        <rect x="170" y="248" width="60" height="14" rx="4" opacity=".7"/>
        <rect x="130" y="268" width="140" height="14" rx="7" opacity=".6"/>`;
    case "phone":
      return `<rect x="140" y="40" width="120" height="230" rx="20" opacity=".9"/>
        <rect x="156" y="66" width="88" height="170" rx="6" fill="#fff" opacity=".3"/>
        <circle cx="200" cy="252" r="8" fill="#fff" opacity=".6"/>
        <rect x="176" y="30" width="48" height="8" rx="4" fill="#fff" opacity=".4"/>`;
    case "signal":
      return `<circle cx="200" cy="220" r="26" opacity=".95"/>
        <path d="M140 190 A85 85 0 0 1 260 190" fill="none" stroke="currentColor" stroke-width="14" opacity=".65"/>
        <path d="M110 155 A130 130 0 0 1 290 155" fill="none" stroke="currentColor" stroke-width="14" opacity=".4"/>`;
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSvg(mediaType: {
  code: string;
  name: string;
  kind: string;
  index: number;
}) {
  const isDigital = mediaType.kind === "DIGITAL";
  const palette = isDigital ? PALETTE_DIGITAL : PALETTE_FISICA;
  const [from, to] = palette[mediaType.index % palette.length];
  const glyph = GLYPH_BY_CODE[mediaType.code] ?? "shelf";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="900" fill="url(#bg)"/>
  <g transform="translate(400 210) scale(1.15)" fill="#ffffff" color="#ffffff" opacity=".92">
    ${drawGlyph(glyph)}
  </g>
  <rect x="70" y="70" width="${72 + mediaType.code.length * 34}" height="86" rx="18" fill="#ffffff" opacity=".16"/>
  <text x="${106}" y="130" font-family="Helvetica, Arial, sans-serif" font-size="54" font-weight="bold" fill="#ffffff">${escapeXml(mediaType.code)}</text>
  <text x="70" y="760" font-family="Helvetica, Arial, sans-serif" font-size="66" font-weight="bold" fill="#ffffff">${escapeXml(mediaType.name)}</text>
  <text x="70" y="820" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#ffffff" opacity=".75">${isDigital ? "Mídia digital" : "Mídia física"} · Catálogo de PDV</text>
</svg>`;
}

async function uploadPng(key: string, body: Buffer) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/png",
    }),
  );
}

async function main() {
  const organization = await prisma.organization.findFirst({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });
  if (!organization) throw new Error(`Org ${ORG_SLUG} não encontrada.`);
  const organizationId = organization.id;

  const mediaTypes = await prisma.mediaType.findMany({
    where: { organizationId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, kind: true },
  });

  let uploaded = 0;
  for (const [index, mediaType] of mediaTypes.entries()) {
    const svg = buildSvg({ ...mediaType, index });
    const png = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
    const key = `media-model/${mediaType.code.toLowerCase()}.png`;

    await uploadPng(key, png);
    uploaded++;

    await prisma.mediaType.update({
      where: { id: mediaType.id },
      data: { defaultPhotos: [key] },
    });

    // Biblioteca global por código — é daqui que generate-pages tira as fotos
    // padrão de cada mídia; estava vazia.
    const existing = await prisma.mediaModelPhoto.findFirst({
      where: { code: mediaType.code },
      select: { id: true },
    });
    if (existing) {
      await prisma.mediaModelPhoto.update({
        where: { id: existing.id },
        data: { imageKey: key },
      });
    } else {
      await prisma.mediaModelPhoto.create({
        data: { code: mediaType.code, imageKey: key, sortOrder: index },
      });
    }
  }
  console.log(`imagens geradas e enviadas: ${uploaded}`);

  const catalog = await prisma.tradeCatalog.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (catalog) {
    const pageIds = await generateTradeCatalogPagesFor({
      catalogId: catalog.id,
      organizationId,
      mediaTypeIds: mediaTypes.map((mediaType) => mediaType.id),
    });
    console.log(`páginas do catálogo atualizadas: ${pageIds.length}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
