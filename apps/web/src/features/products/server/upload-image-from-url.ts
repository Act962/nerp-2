import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 10_000;

function extFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
  };
  const base = contentType.split(";")[0].trim().toLowerCase();
  return map[base] ?? "jpg";
}

/**
 * Faz download de uma URL externa e faz upload direto ao R2.
 * Retorna a S3 key gerada, ou null em caso de qualquer falha (não lança exceção).
 *
 * Limites: 5 MB por imagem, timeout de 10 s, apenas content-type image/*.
 */
export async function uploadImageFromUrl(url: string): Promise<string | null> {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BYTES) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) return null;

    const ext = extFromContentType(contentType);
    const key = `imports/${uuidv4()}.${ext}`;

    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
        Key: key,
        Body: Buffer.from(buffer),
        ContentType: contentType.split(";")[0].trim(),
      }),
    );

    return key;
  } catch {
    return null;
  }
}
