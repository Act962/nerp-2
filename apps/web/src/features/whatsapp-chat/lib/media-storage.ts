import "server-only";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";

/**
 * Guarda da mídia recebida e enviada nas conversas.
 *
 * Vai para **bucket privado**, nunca o de imagens. O de imagens é servido por
 * `/api/s3/image`, que é público por natureza — foto que um cliente mandou no
 * WhatsApp ficaria acessível por URL para qualquer um que a adivinhasse. Mesmo
 * raciocínio (e mesmo bucket) do certificado fiscal.
 *
 * A key carrega a organização no caminho: é o que permite auditar por tenant e
 * o que `pertenceAOrg` usa para barrar leitura de key adivinhada.
 */

export const WHATSAPP_KEY_PREFIX = "whatsapp/";

/**
 * Bucket privado. Aceita `WHATSAPP_S3_BUCKET_NAME` para quem quiser separar,
 * e cai no bucket do fiscal — que já é privado — para não exigir provisionar
 * um bucket novo só por causa desta feature. Falha se nenhum existir: nunca
 * cai no bucket de imagens.
 */
export function whatsappBucket(): string {
  const bucket =
    process.env.WHATSAPP_S3_BUCKET_NAME ?? process.env.FISCAL_S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error(
      "Sem bucket privado para a mídia do WhatsApp. Defina WHATSAPP_S3_BUCKET_NAME (ou reaproveite FISCAL_S3_BUCKET_NAME). O bucket precisa ser PRIVADO.",
    );
  }
  return bucket;
}

export function midiaObjectKey(
  organizationId: string,
  conversationId: string,
  extensao: string,
): string {
  const limpa = extensao.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${WHATSAPP_KEY_PREFIX}${organizationId}/${conversationId}/${uuidv4()}.${limpa}`;
}

/** A key é desta organização? Barreira contra key adivinhada. */
export function pertenceAOrg(key: string, organizationId: string): boolean {
  return key.startsWith(`${WHATSAPP_KEY_PREFIX}${organizationId}/`);
}

export async function guardarMidia(
  key: string,
  conteudo: Buffer,
  contentType: string,
): Promise<void> {
  await S3.send(
    new PutObjectCommand({
      Bucket: whatsappBucket(),
      Key: key,
      Body: conteudo,
      ContentType: contentType,
    }),
  );
}

export async function lerMidia(key: string): Promise<{
  corpo: Buffer;
  contentType: string;
}> {
  const objeto = await S3.send(
    new GetObjectCommand({ Bucket: whatsappBucket(), Key: key }),
  );
  const bytes = await objeto.Body?.transformToByteArray();
  if (!bytes) throw new Error("Objeto vazio no bucket");
  return {
    corpo: Buffer.from(bytes),
    contentType: objeto.ContentType ?? "application/octet-stream",
  };
}

/** Extensão a partir do mimetype, para a key ficar legível no bucket. */
export function extensaoDoMime(mimetype: string | undefined): string {
  if (!mimetype) return "bin";
  const conhecidos: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "application/pdf": "pdf",
  };
  const semParametros = mimetype.split(";")[0]?.trim() ?? "";
  return conhecidos[semParametros] ?? semParametros.split("/")[1] ?? "bin";
}
