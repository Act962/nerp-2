import { readFileSync } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import prisma from "@/lib/db";
import sharp from "sharp";

// Sobe uma imagem de logo ao R2 e liga em Organization.logo. Uso pontual:
// SEED_ORG_SLUG, SEED_LOGO_PATH nas envs.
const ORG_SLUG = process.env.SEED_ORG_SLUG;
const SRC = process.env.SEED_LOGO_PATH;
const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
if (!ORG_SLUG || !SRC || !BUCKET) {
  throw new Error("Defina SEED_ORG_SLUG, SEED_LOGO_PATH e o bucket.");
}

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  forcePathStyle: false,
});

async function main() {
  const png = await sharp(readFileSync(SRC as string))
    .resize(512, 512, { fit: "inside" })
    .png()
    .toBuffer();
  const key = `org-logo/${ORG_SLUG}.png`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: png,
      ContentType: "image/png",
    }),
  );

  const org = await prisma.organization.update({
    where: { slug: ORG_SLUG as string },
    data: { logo: key },
    select: { name: true, logo: true },
  });
  console.log(`logo definida: ${org.name} → ${org.logo}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
