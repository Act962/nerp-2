import prisma from "@/lib/db";
import sharp from "sharp";

// Marca para refazer as fotos que caíram em acervo histórico. Preto e branco é
// o indicador barato: o Commons tem muita foto de arquivo, e uma vitrine de
// 1917 não representa "Checkout" num catálogo comercial.

const ORG_SLUG = "gotham";
const PUBLIC_HOST = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
if (!PUBLIC_HOST)
  throw new Error("Falta NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL.");

async function colorSpread(key: string) {
  const response = await fetch(`https://${PUBLIC_HOST}/${key}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(buffer)
    .resize(64, 64, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels < 3) return 0;

  let total = 0;
  const pixels = data.length / info.channels;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    total += Math.max(red, green, blue) - Math.min(red, green, blue);
  }
  return total / pixels;
}

async function main() {
  const organization = await prisma.organization.findFirst({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });
  if (!organization) throw new Error(`Org ${ORG_SLUG} não encontrada.`);

  const mediaTypes = await prisma.mediaType.findMany({
    where: { organizationId: organization.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, defaultPhotos: true },
  });

  const flagged: string[] = [];
  for (const mediaType of mediaTypes) {
    const key = mediaType.defaultPhotos[0];
    if (!key) continue;
    const spread = await colorSpread(key);
    if (spread === null) continue;
    if (spread < 12) {
      flagged.push(
        `${mediaType.code} (${mediaType.name}) spread=${spread.toFixed(1)}`,
      );
      // Volta para .png para o fetch reprocessar esta mídia.
      await prisma.mediaType.update({
        where: { id: mediaType.id },
        data: {
          defaultPhotos: [`media-model/${mediaType.code.toLowerCase()}.png`],
        },
      });
    }
  }

  console.log(`marcadas para refazer: ${flagged.length}`);
  for (const item of flagged) console.log(`  ${item}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
