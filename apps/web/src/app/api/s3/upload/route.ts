import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  CotaDeUploadExcedidaError,
  reservarCotaDeUpload,
} from "@/features/uploads/server/cota";
import { prefixoDaOrg } from "@/features/uploads/server/posse";
import { getApiSession } from "@/lib/api-auth";
import { auth } from "@/lib/auth";
import { S3 } from "@/lib/s3-client";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
// Vídeo (mídia do PDV) tem um teto próprio, maior — sem afrouxar o limite das
// imagens/planilhas. Clipes de loja curtos cabem folgados em 50MB.
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_CONTENT_TYPES = new Set(["video/mp4", "video/webm"]);

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
  // Vídeo da mídia promocional do PDV.
  "video/mp4",
  "video/webm",
  // O certificado digital A1 (.pfx) JÁ ESTEVE nesta lista e não pode voltar:
  // este bucket é servido por `/api/s3/image`, que não tem sessão. O upload do
  // certificado é `fiscalConfig.uploadCertificate`, que valida a senha, confere
  // o CNPJ e grava no bucket fiscal PRIVADO.
]);

const fileUploadSchema = z
  .object({
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
    size: z.number().int().min(1, "Size is required"),
    isImage: z.boolean(),
    // Uma subpasta DENTRO do prefixo da organização, para separar o que vem
    // de um caminho específico (hoje, os anexos do Astro). Formato fechado:
    // barra ou ponto-ponto aqui escapariam do prefixo, que é o que decide a
    // posse do objeto.
    pasta: z
      .string()
      .regex(/^[a-z0-9-]{1,20}$/, "Pasta inválida")
      .optional(),
  })
  .superRefine((data, ctx) => {
    const isVideo = VIDEO_CONTENT_TYPES.has(data.contentType.toLowerCase());
    const limit = isVideo ? MAX_VIDEO_BYTES : MAX_UPLOAD_BYTES;
    if (data.size > limit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["size"],
        message: isVideo
          ? "Vídeo excede o limite de 50MB"
          : "Arquivo excede o limite de 15MB",
      });
    }
  });

export async function POST(request: Request) {
  try {
    const session = await getApiSession(request);
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // O objeto nasce com dono: o id da organização vira prefixo da chave, e
    // é por ele que `/api/s3/delete` decide quem pode apagar. Sessão sem
    // organização ativa não tem onde pendurar o arquivo.
    const org = await auth.api
      .getFullOrganization({ headers: request.headers })
      .catch(() => null);
    if (!org) {
      return NextResponse.json({ error: "Sem organização" }, { status: 403 });
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

    const { fileName, contentType, size, pasta } = validation.data;

    // O nome vem do dispositivo do usuário: sem sanitizar, uma barra cria
    // objeto sob prefixo arbitrário do bucket (inclusive `trade-catalogs/`).
    const safeFileName = fileName.replace(/[^\w.-]/g, "_");
    const uniqueKey = `${prefixoDaOrg(org.id)}${pasta ? `${pasta}/` : ""}${uuidv4()}-${safeFileName}`;

    // Cota reservada ANTES de assinar: o PUT vai direto ao R2 e o servidor
    // nunca o vê, então a assinatura é o único ponto de controle.
    try {
      await reservarCotaDeUpload({ organizationId: org.id, bytes: size });
    } catch (erro) {
      if (erro instanceof CotaDeUploadExcedidaError) {
        return NextResponse.json(
          { error: "Limite diário de upload atingido" },
          { status: 413 },
        );
      }
      throw erro;
    }

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
