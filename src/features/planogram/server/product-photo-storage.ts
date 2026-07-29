import "server-only";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";
import { v4 as uuidv4 } from "uuid";

// Leitura e gravação da foto de produto usada pelo planograma. Vive fora das
// procedures porque tanto o envio de uma foto nova quanto o recorte da foto já
// cadastrada precisam exatamente do mesmo par de operações.

/**
 * Baixa a foto atual do produto.
 *
 * `Product.thumbnail` guarda a chave do bucket, mas registros antigos e alguns
 * importadores gravaram a URL pública inteira — por isso os dois formatos são
 * aceitos. URL de outro host é recusada: a origem vem do banco, e sair buscando
 * host arbitrário a partir daí transformaria o recorte em SSRF.
 */
export async function loadProductPhoto(thumbnail: string): Promise<Buffer> {
  if (thumbnail.startsWith("http://") || thumbnail.startsWith("https://")) {
    const bucketHost = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
    const host = new URL(thumbnail).host;
    if (!bucketHost || host !== bucketHost) {
      throw new Error("Foto hospedada fora do armazenamento da aplicação");
    }
    const response = await fetch(thumbnail);
    if (!response.ok) throw new Error("Foto atual inacessível");
    return Buffer.from(await response.arrayBuffer());
  }

  const object = await S3.send(
    new GetObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
      Key: thumbnail,
    }),
  );
  const bytes = await object.Body?.transformToByteArray();
  if (!bytes?.length) throw new Error("Foto atual vazia ou inacessível");
  return Buffer.from(bytes);
}

/** Grava o recorte sob uma chave nova e devolve a chave. */
export async function storeNormalizedPhoto(buffer: Buffer): Promise<string> {
  const key = `planogram/normalized/${uuidv4()}.webp`;
  await S3.send(
    new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
      Key: key,
      Body: buffer,
      ContentType: "image/webp",
    }),
  );
  return key;
}
