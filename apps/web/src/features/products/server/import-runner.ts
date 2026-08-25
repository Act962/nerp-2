import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { S3 } from "@/lib/s3-client";
import type { ImportMapping } from "@/features/products/import-fields";
import { createProductForOrg } from "./create-product";
import { mapRow, parseSheet, type SheetRow } from "./parse-import";
import { uploadImageFromUrl } from "./upload-image-from-url";

interface RowError {
  row: number;
  message: string;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

/**
 * Resolve o nome de uma categoria para um id, criando-a na org se necessário.
 * Usa um cache para evitar consultas repetidas dentro da mesma importação.
 */
async function resolveCategoryId(
  name: string,
  orgId: string,
  cache: Map<string, string>,
): Promise<string> {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const slug = slugify(name);
  const existing = await prisma.category.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ slug }, { name }],
    },
  });

  const id = existing
    ? existing.id
    : (
        await prisma.category.create({
          data: { name, slug, organizationId: orgId },
        })
      ).id;

  cache.set(key, id);
  return id;
}

/**
 * Baixa o arquivo do S3 (CSV/XLSX), parseia e cria os produtos linha a linha.
 *
 * Importação parcial: cada linha é validada/criada isoladamente; falhas são
 * acumuladas em `errors` sem abortar o restante. Atualiza os contadores no
 * `ProductImport` periodicamente para a UI acompanhar o progresso.
 */
export async function runProductImport(importId: string): Promise<void> {
  const record = await prisma.productImport.findUnique({
    where: { id: importId },
  });
  if (!record) throw new Error(`ProductImport ${importId} não encontrado`);

  const mapping = record.mapping as ImportMapping;

  // 1. Baixa o arquivo do S3.
  const object = await S3.send(
    new GetObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
      Key: record.fileKey,
    }),
  );
  const bytes = await object.Body?.transformToByteArray();
  if (!bytes) throw new Error("Arquivo de importação vazio ou inacessível");
  const buffer = Buffer.from(bytes);

  // 2. Parseia as linhas.
  const rows: SheetRow[] = parseSheet(buffer);

  await prisma.productImport.update({
    where: { id: importId },
    data: { status: "PROCESSING", totalRows: rows.length },
  });

  // 3. Processa linha a linha.
  const categoryCache = new Map<string, string>();
  const errors: RowError[] = [];
  let createdRows = 0;
  let processedRows = 0;

  for (let i = 0; i < rows.length; i++) {
    // +2: linha 1 é o cabeçalho; índice começa em 0 → número humano da planilha.
    const rowNumber = i + 2;
    try {
      const mapped = mapRow(rows[i], mapping);
      if (mapped.error) {
        errors.push({ row: rowNumber, message: mapped.error });
      } else {
        let categoryId: string | null = null;
        if (mapped.categoryName) {
          categoryId = await resolveCategoryId(
            mapped.categoryName,
            record.organizationId,
            categoryCache,
          );
        }

        const [thumbnailKey, ...extraImageKeys] = await Promise.all([
          mapped.thumbnailUrl
            ? uploadImageFromUrl(mapped.thumbnailUrl)
            : Promise.resolve(null),
          ...(mapped.imageUrls ?? []).map(uploadImageFromUrl),
        ]);
        const imageKeys = extraImageKeys.filter((k): k is string => k !== null);

        await createProductForOrg(
          {
            ...mapped.input,
            categoryId,
            thumbnail: thumbnailKey ?? undefined,
            images: imageKeys.length ? imageKeys : undefined,
          },
          { orgId: record.organizationId, userId: record.createdById },
        );
        createdRows++;
      }
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    processedRows++;

    // Checkpoint de progresso a cada 25 linhas (e no fim).
    if (processedRows % 25 === 0) {
      await prisma.productImport.update({
        where: { id: importId },
        data: {
          processedRows,
          createdRows,
          failedRows: errors.length,
          errors: errors as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  // 4. Finaliza.
  await prisma.productImport.update({
    where: { id: importId },
    data: {
      status: "COMPLETED",
      processedRows,
      createdRows,
      failedRows: errors.length,
      errors: errors as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
}
