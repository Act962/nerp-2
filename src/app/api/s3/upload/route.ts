import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getApiSession } from "@/lib/api-auth";
import { S3 } from "@/lib/s3-client";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Lista fechada, não prefixo `image/`: `image/svg+xml` é um documento que
// executa script quando o objeto é aberto direto pela URL do bucket. Como o
// Content-Type assinado aqui é o que o R2 devolve na resposta, manter SVG e
// XML fora da lista é o que impede hospedar página ativa no domínio de assets.
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/avif",
  "application/pdf",
  // Planilhas de importação (clientes/fornecedores/produtos/lojas) — o
  // wizard sobe o CSV/XLSX bruto aqui antes de disparar o processamento.
  // "application/octet-stream" cobre o caso comum de `file.type` vir vazio
  // (alguns navegadores/SOs não reconhecem .csv/.xlsx).
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

const fileUploadSchema = z.object({
  fileName: z
    .string()
    .min(1, "Nome do arquivo é obrigatório")
    .max(200, "Nome do arquivo muito longo"),
  contentType: z
    .string()
    .min(1, "Content type is required")
    .refine((value) => ALLOWED_CONTENT_TYPES.has(value.toLowerCase()), {
      message: "Tipo de arquivo não permitido",
    }),
  size: z
    .number()
    .int()
    .min(1, "Size is required")
    .max(MAX_UPLOAD_BYTES, "Arquivo excede o limite de 15MB"),
  isImage: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const session = await getApiSession(request);
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();

    const validation = fileUploadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid Request Body",
        },
        {
          status: 400,
        },
      );
    }

    const { fileName, contentType, size } = validation.data;

    // O nome vem do dispositivo do usuário: sem sanitizar, uma barra cria
    // objeto sob prefixo arbitrário do bucket (inclusive `trade-catalogs/`).
    const safeFileName = fileName.replace(/[^\w.-]/g, "_");
    const uniqueKey = `${uuidv4()}-${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
      ContentType: contentType,
      ContentLength: size,
      Key: uniqueKey,
    });

    const presignedUrl = await getSignedUrl(S3, command, {
      expiresIn: 360, // 6 minutes
    });

    const response = {
      presignedUrl,
      key: uniqueKey,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      {
        error: "Failed to generate presigned URL",
      },
      {
        status: 500,
      },
    );
  }
}
