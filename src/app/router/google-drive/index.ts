import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/db";
import { downloadDriveFile, listDriveChildren } from "@/lib/google/drive";
import { getFreshGoogleAccessToken } from "@/lib/google/token-manager";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { S3 } from "@/lib/s3-client";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const p = base.use(requireAuthMiddleware).use(requireOrgMiddleware);

// Estado da conexão do usuário logado + org ativa.
const getConnection = p
  .input(z.object({}).optional())
  .output(
    z.object({
      connected: z.boolean(),
      email: z.string().nullable(),
      connectedAt: z.string().nullable(),
    }),
  )
  .handler(async ({ context }) => {
    const conn = await prisma.googleDriveConnection.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.org.id,
          userId: context.user.id,
        },
      },
      select: { googleEmail: true, createdAt: true },
    });
    return {
      connected: !!conn,
      email: conn?.googleEmail ?? null,
      connectedAt: conn?.createdAt.toISOString() ?? null,
    };
  });

const disconnect = p
  .input(z.object({}).optional())
  .output(z.object({ ok: z.boolean() }))
  .handler(async ({ context }) => {
    await prisma.googleDriveConnection
      .delete({
        where: {
          organizationId_userId: {
            organizationId: context.org.id,
            userId: context.user.id,
          },
        },
      })
      .catch(() => undefined);
    return { ok: true };
  });

// Lista pastas + imagens filhas de um `parentId`. Usado pelo seletor de pasta
// no assistente de importação. Sem parentId = raiz do Drive do usuário.
const listChildren = p
  .input(
    z.object({
      parentId: z.string().nullable().optional(),
      onlyImages: z.boolean().optional(),
      pageToken: z.string().nullable().optional(),
    }),
  )
  .output(
    z.object({
      files: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          mimeType: z.string(),
          size: z.string().optional(),
          isFolder: z.boolean(),
          isImage: z.boolean(),
        }),
      ),
      nextPageToken: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const conn = await prisma.googleDriveConnection.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.org.id,
          userId: context.user.id,
        },
      },
      select: { id: true },
    });
    if (!conn)
      throw errors.NOT_FOUND({ message: "Google Drive não conectado" });

    const { accessToken } = await getFreshGoogleAccessToken(conn.id);
    const { files, nextPageToken } = await listDriveChildren(accessToken, {
      parentId: input.parentId ?? null,
      onlyImages: input.onlyImages ?? false,
      pageToken: input.pageToken ?? undefined,
    });
    return {
      files: files.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        isFolder: file.isFolder,
        isImage: file.isImage,
      })),
      nextPageToken: nextPageToken ?? null,
    };
  });

// Copia UM arquivo de imagem do Drive pro bucket R2 e devolve a `key` do R2
// (compatível com products.setImages). O client chama esta procedure por
// arquivo dentro de um loop com concorrência limitada — mantém compatível
// com o pipeline de upload que já existe.
//
// Fluxo:
//   client → RPC copyFileToBucket({fileId})
//         → server puxa o arquivo via Drive API (usa accessToken renovado)
//         → PUT direto no R2 via SDK (server-side, sem passar pelo browser)
//         → devolve { key, contentType, size }
const copyFileToBucket = p
  .input(z.object({ fileId: z.string() }))
  .output(
    z.object({
      key: z.string(),
      contentType: z.string(),
      size: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const conn = await prisma.googleDriveConnection.findUnique({
      where: {
        organizationId_userId: {
          organizationId: context.org.id,
          userId: context.user.id,
        },
      },
      select: { id: true },
    });
    if (!conn)
      throw errors.NOT_FOUND({ message: "Google Drive não conectado" });

    const { accessToken } = await getFreshGoogleAccessToken(conn.id);
    // Meta + conteúdo. Precisamos do nome de arquivo pra preservar o SKU
    // no nome da chave (matching do UI depois).
    const [meta, download] = await Promise.all([
      // GET file metadata (name + mimeType).
      fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}?fields=id,name,mimeType,size`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ).then(async (r) => {
        if (!r.ok) throw new Error(`meta falhou (${r.status})`);
        return r.json() as Promise<{
          id: string;
          name: string;
          mimeType: string;
          size?: string;
        }>;
      }),
      downloadDriveFile(accessToken, input.fileId),
    ]);

    if (!download.contentType.startsWith("image/"))
      throw errors.BAD_REQUEST({
        message: `Arquivo "${meta.name}" não é imagem (${download.contentType})`,
      });

    // Sanitiza o nome como em /api/s3/upload — mesma regra.
    const safeFileName = meta.name.replace(/[^\w.-]/g, "_");
    const key = `${uuidv4()}-${safeFileName}`;

    const buffer = Buffer.from(await download.blob.arrayBuffer());
    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
        Key: key,
        Body: buffer,
        ContentType: download.contentType,
        ContentLength: download.size,
      }),
    );

    return { key, contentType: download.contentType, size: download.size };
  });

export const googleDriveRoutes = {
  getConnection,
  disconnect,
  listChildren,
  copyFileToBucket,
};
