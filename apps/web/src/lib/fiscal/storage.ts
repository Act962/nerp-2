import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";

/**
 * Armazenamento dos artefatos fiscais (certificado A1, XML, DANFCe).
 *
 * Bucket SEPARADO e privado, nunca o de imagens. O de imagens é servido por
 * `/api/s3/image`, que é público por natureza — misturar os dois foi o que
 * deixou o certificado ICP-Brasil baixável sem sessão.
 *
 * Nada aqui gera URL pública nem presigned: todo acesso passa pelo servidor,
 * que checa org e papel antes de ler o objeto.
 */

/** Prefixo obrigatório de qualquer objeto fiscal. */
export const FISCAL_KEY_PREFIX = "fiscal/";

/**
 * Nome do bucket fiscal. FALHA se a env não existir — nunca cai no bucket de
 * imagens como fallback, que é exatamente o erro que esta camada corrige.
 */
export function fiscalBucket(): string {
  const bucket = process.env.FISCAL_S3_BUCKET_NAME;
  if (!bucket)
    throw new Error(
      "FISCAL_S3_BUCKET_NAME ausente. Crie um bucket PRIVADO (sem acesso público) e aponte a env para ele.",
    );
  return bucket;
}

/**
 * Key do certificado de uma org. O `uuid` no nome evita que trocar o
 * certificado sobrescreva o anterior antes de o novo ser validado, e o prefixo
 * por org é o que permite auditar/limpar por tenant.
 */
export function certificateObjectKey(organizationId: string): string {
  return `${FISCAL_KEY_PREFIX}${organizationId}/certificates/${uuidv4()}.pfx`;
}

/** A key pertence a esta org? Barreira contra IDOR por key adivinhada. */
export function belongsToOrg(key: string, organizationId: string): boolean {
  return key.startsWith(`${FISCAL_KEY_PREFIX}${organizationId}/`);
}

export async function putFiscalObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await S3.send(
    new PutObjectCommand({
      Bucket: fiscalBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getFiscalObject(key: string): Promise<Buffer> {
  const object = await S3.send(
    new GetObjectCommand({ Bucket: fiscalBucket(), Key: key }),
  );
  if (!object.Body) throw new Error(`Objeto fiscal não encontrado: ${key}`);
  return Buffer.from(await object.Body.transformToByteArray());
}

/**
 * Remove um objeto fiscal. Usado ao trocar o certificado — deixar o antigo no
 * bucket amplia a superfície sem nenhum ganho.
 *
 * Não propaga erro: a troca do certificado já foi persistida quando isto roda,
 * e falhar aqui não deve desfazer a operação do usuário.
 */
export async function deleteFiscalObject(key: string): Promise<void> {
  try {
    await S3.send(
      new DeleteObjectCommand({ Bucket: fiscalBucket(), Key: key }),
    );
  } catch {
    // Objeto órfão é problema de limpeza, não de correção.
  }
}
