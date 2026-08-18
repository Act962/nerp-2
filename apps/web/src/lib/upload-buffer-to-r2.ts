import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "./s3-client";

/** Envia um Buffer direto ao R2 (uso server-side, ex.: PDF gerado em job). */
export async function uploadBufferToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await S3.send(
    new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
