import "dotenv/config";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import prisma from "@/lib/db";
import { normalizeProductImage } from "@/features/planogram/server/normalize-product-image";
import { v4 as uuidv4 } from "uuid";

// Cliente próprio: `@/lib/s3-client` traz `import "server-only"`, que não
// resolve fora do runtime do Next.
const S3 = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: false,
});

function constructUrl(key: string): string {
  if (!key) return "";
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  return `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
}

// Recorta o fundo das fotos de produto já cadastradas e regrava no R2.
//
// Por que existe: o render usa a proporção do ARQUIVO para assentar a foto na
// gôndola. Foto de catálogo vem quadrada com o produto pequeno no meio, então
// uma garrafa alta desenha como se fosse quadrada e sobra vazio na prateleira.
// Recortar até o contorno do produto resolve sem tocar no render.
//
// Uso:
//   npx tsx scripts/normalize-product-images.ts            # simulação
//   npx tsx scripts/normalize-product-images.ts --apply    # grava
//   npx tsx scripts/normalize-product-images.ts --apply --id=<productId>
//
// A imagem ORIGINAL nunca é apagada: gravamos uma chave nova e repontamos o
// produto. Se o recorte sair ruim, é só voltar a chave antiga.

const isApply = process.argv.includes("--apply");
const onlyId = process.argv
  .find((arg) => arg.startsWith("--id="))
  ?.slice("--id=".length);

const MAX_BYTES = 10 * 1024 * 1024;

async function downloadThumbnail(thumbnail: string): Promise<Buffer | null> {
  const url = constructUrl(thumbnail);
  if (!url) return null;

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) return null;

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) return null;
  return Buffer.from(arrayBuffer);
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      thumbnail: { not: "" },
      ...(onlyId ? { id: onlyId } : {}),
    },
    select: { id: true, name: true, thumbnail: true },
    orderBy: { name: "asc" },
  });

  console.log(
    `${products.length} produto(s) com foto${isApply ? "" : " — SIMULAÇÃO, nada será gravado"}\n`,
  );

  let normalized = 0;
  let suspect = 0;
  let failed = 0;

  for (const product of products) {
    const original = await downloadThumbnail(product.thumbnail);
    if (!original) {
      console.log(`  -- ${product.name}: não consegui baixar a foto`);
      failed++;
      continue;
    }

    let result: Awaited<ReturnType<typeof normalizeProductImage>>;
    try {
      result = await normalizeProductImage(original);
    } catch (error) {
      console.log(`  XX ${product.name}: ${(error as Error).message}`);
      failed++;
      continue;
    }

    const shrink = `${(result.areaRatio * 100).toFixed(0)}% da área`;
    const summary = `${result.widthPx}x${result.heightPx} (razão ${(
      result.widthPx / result.heightPx
    ).toFixed(
      3,
    )}, ${shrink}${result.keyedBackground ? ", fundo removido" : ""})`;

    if (result.status === "SUSPECT") {
      console.log(`  !! ${product.name}: ${result.reason} — mantida como está`);
      suspect++;
      continue;
    }

    console.log(`  ok ${product.name}: ${summary}`);
    normalized++;

    if (!isApply) continue;

    const key = `planogram/normalized/${uuidv4()}.webp`;
    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
        Key: key,
        Body: result.buffer,
        ContentType: "image/webp",
      }),
    );
    await prisma.product.update({
      where: { id: product.id },
      data: { thumbnail: key },
    });
    console.log(`     -> ${key}`);
  }

  console.log(
    `\n${normalized} normalizada(s), ${suspect} suspeita(s), ${failed} falha(s)`,
  );
  if (!isApply && normalized > 0) {
    console.log("Rode de novo com --apply para gravar.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
