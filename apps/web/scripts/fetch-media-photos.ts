import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { generateTradeCatalogPagesFor } from "@/features/pdv-catalog/server/generate-pages";
import prisma from "@/lib/db";
import sharp from "sharp";

// Busca uma FOTO real para cada tipo de mídia no Wikimedia Commons (licenças
// livres, sem chave de API), normaliza e envia ao R2. Gera também um manifesto
// de créditos, porque boa parte das licenças do Commons exige atribuição.

const ORG_SLUG = "gotham";
const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
const PUBLIC_HOST = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
const USER_AGENT = "nerp-2-trade-seed/1.0 (seed de catálogo; contato via app)";
const CREDITS_PATH = "scripts/media-photo-credits.json";

if (!BUCKET || !PUBLIC_HOST) {
  throw new Error("Faltam as variáveis de bucket do R2.");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: false,
});

// Termos em inglês: o acervo do Commons é muito mais rico nesse idioma.
const SEARCH_BY_CODE: Record<string, string> = {
  PG: "supermarket endcap display",
  GO: "supermarket shelf aisle products",
  IL: "grocery store display",
  CK: "supermarket checkout counter",
  CM: "supermarket product display stand",
  FR: "supermarket frozen food freezer",
  GL: "supermarket refrigerator drinks",
  DP: "cardboard display",
  ST: "supermarket product stack display",
  PL: "supermarket pallet display",
  TG: "supermarket aisle end display",
  FG: "supermarket shelf price label",
  SP: "store price sign",
  WB: "shop advertising sign",
  MB: "hanging advertising sign store",
  BN: "advertising banner shop",
  TT: "advertising totem sign",
  AP: "floor graphics advertising",
  AD: "painted wall advertisement",
  CS: "hanging sign supermarket ceiling",
  PI: "indoor advertising panel",
  FC: "supermarket facade building",
  ET: "supermarket parking lot",
  CR: "shopping cart supermarket",
  CE: "shopping basket supermarket",
  EN: "supermarket entrance",
  SD: "supermarket exit door",
  AC: "supermarket butcher meat counter",
  PA: "supermarket bakery bread",
  HF: "supermarket fruit vegetables produce",
  AG: "supermarket wine shelf",
  QR: "qr code sign",
  TV: "digital signage screen store",
  LED: "LED billboard",
  TD: "interactive kiosk touchscreen",
  ED: "electronic shelf label",
  RI: "loudspeaker public address",
  APP: "smartphone shopping application",
  WA: "smartphone messaging application",
  PN: "smartphone notification screen",
  GEO: "smartphone map navigation",
  MAP: "digital map screen",
  CP: "discount coupon",
  CB: "credit card payment terminal",
  FD: "loyalty card",
  RM: "digital signage advertising",
};

interface CommonsImage {
  title: string;
  thumbUrl: string;
  descriptionUrl: string;
  license: string;
  artist: string;
  width: number;
  height: number;
}

function stripHtml(value: string | undefined) {
  if (!value) return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// O Commons devolve 429 em rajada e, na API de busca, um resultado vazio em vez
// de erro — por isso o backoff cobre os dois casos.
async function withRetry<T>(
  label: string,
  attempt: () => Promise<T>,
  isEmpty: (value: T) => boolean,
): Promise<T> {
  let last = await attempt();
  for (let retry = 1; retry <= 4 && isEmpty(last); retry++) {
    const waitMs = 2000 * 2 ** (retry - 1);
    console.log(`    ${label}: nova tentativa em ${waitMs / 1000}s`);
    await sleep(waitMs);
    last = await attempt();
  }
  return last;
}

async function searchCommons(term: string): Promise<CommonsImage[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", `filetype:bitmap ${term}`);
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata|size");
  url.searchParams.set("iiurlwidth", "1400");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) return [];

  const payload = (await response.json()) as {
    query?: { pages?: Record<string, Record<string, unknown>> };
  };
  const pages = Object.values(payload.query?.pages ?? {});

  return pages.flatMap((page) => {
    const info = (page.imageinfo as Record<string, unknown>[] | undefined)?.[0];
    if (!info?.thumburl) return [];
    const metadata = info.extmetadata as
      | Record<string, { value?: string }>
      | undefined;
    return [
      {
        title: String(page.title ?? ""),
        thumbUrl: String(info.thumburl),
        descriptionUrl: String(info.descriptionurl ?? ""),
        license: stripHtml(metadata?.LicenseShortName?.value) || "ver origem",
        artist: stripHtml(metadata?.Artist?.value) || "desconhecido",
        width: Number(info.width ?? 0),
        height: Number(info.height ?? 0),
      },
    ];
  });
}

async function downloadImage(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
      signal: AbortSignal.timeout(40000),
    });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 5);
      console.log(`    429 no download; aguardando ${retryAfter}s`);
      await sleep(Math.min(retryAfter, 30) * 1000);
      return null;
    }
    if (!response.ok) {
      console.log(`    download HTTP ${response.status}`);
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.log(`    download falhou: ${(error as Error).message}`);
    return null;
  }
}

// Média da diferença entre canais numa miniatura: perto de zero significa
// imagem sem cor.
async function isGrayscale(buffer: Buffer) {
  try {
    const { data, info } = await sharp(buffer)
      .resize(64, 64, { fit: "inside" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels < 3) return true;

    let totalSpread = 0;
    const pixels = data.length / info.channels;
    for (let offset = 0; offset < data.length; offset += info.channels) {
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      totalSpread += Math.max(red, green, blue) - Math.min(red, green, blue);
    }
    return totalSpread / pixels < 12;
  } catch {
    return false;
  }
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
    select: { id: true, code: true, name: true, defaultPhotos: true },
  });

  const credits: Record<string, unknown> = existsSync(CREDITS_PATH)
    ? JSON.parse(readFileSync(CREDITS_PATH, "utf8"))
    : {};
  const failures: string[] = [];

  for (const mediaType of mediaTypes) {
    // Foto real termina em .jpg; a ilustração gerada é .png. Assim o script é
    // retomável e converge rodando algumas vezes, sem refazer o que já deu certo.
    const current = mediaType.defaultPhotos[0] ?? "";
    if (current.endsWith(".jpg")) continue;

    const term = SEARCH_BY_CODE[mediaType.code];
    if (!term) {
      failures.push(`${mediaType.code} (sem termo de busca)`);
      continue;
    }

    // Pausa entre mídias: o Commons estrangula rajadas e as buscas passavam a
    // voltar vazias depois das primeiras.
    await sleep(2500);

    const candidates = await withRetry(
      mediaType.code,
      () => searchCommons(term),
      (results) => results.length === 0,
    );
    if (candidates.length === 0) {
      console.log(`${mediaType.code} — busca sem resultados para "${term}"`);
    }
    // Paisagem primeiro: o catálogo mostra as fotos em caixa deitada.
    const ordered = [...candidates].sort(
      (a, b) => b.width / (b.height || 1) - a.width / (a.height || 1),
    );

    let saved = false;
    for (const candidate of ordered.slice(0, 3)) {
      const original = await downloadImage(candidate.thumbUrl);
      if (!original) continue;
      try {
        // O Commons devolve muito acervo histórico; preto e branco é o sinal
        // mais barato disso, e foto de 1917 não serve a catálogo comercial.
        if (await isGrayscale(original)) {
          console.log(`    descartada (preto e branco): ${candidate.title}`);
          continue;
        }
        const jpeg = await sharp(original)
          .resize(1200, 900, { fit: "cover", position: "centre" })
          .jpeg({ quality: 82 })
          .toBuffer();
        const key = `media-model/${mediaType.code.toLowerCase()}.jpg`;

        await s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: jpeg,
            ContentType: "image/jpeg",
          }),
        );

        await prisma.mediaType.update({
          where: { id: mediaType.id },
          data: { defaultPhotos: [key] },
        });
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
            data: { code: mediaType.code, imageKey: key },
          });
        }

        credits[mediaType.code] = {
          mediaType: mediaType.name,
          key,
          source: candidate.descriptionUrl,
          license: candidate.license,
          author: candidate.artist,
        };
        console.log(
          `${mediaType.code} ✓ ${candidate.license} — ${mediaType.name}`,
        );
        saved = true;
        break;
      } catch (error) {
        console.log(`    processamento falhou: ${(error as Error).message}`);
      }
    }

    if (!saved) failures.push(`${mediaType.code} (${mediaType.name})`);
  }

  writeFileSync(CREDITS_PATH, `${JSON.stringify(credits, null, 2)}\n`);
  console.log(
    `\nfotos aplicadas: ${Object.keys(credits).length}/${mediaTypes.length}`,
  );
  if (failures.length > 0) {
    console.log(`sem foto (mantida a ilustração): ${failures.join(", ")}`);
  }

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
