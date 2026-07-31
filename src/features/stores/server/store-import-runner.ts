import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { S3 } from "@/lib/s3-client";
import type { ImportMapping } from "@/features/stores/import-fields";
import { createStoreForOrg } from "./create-store-for-org";
import { mapStoreRow, parseSheet, type SheetRow } from "./parse-store-import";

interface RowError {
  row: number;
  message: string;
}

/** Código normalizado (trim + maiúsculas) — usado para comparar duplicados. */
function normalizeCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Baixa o arquivo do S3 (CSV/XLSX), parseia e cria as lojas linha a linha.
 *
 * Importação parcial: cada linha é validada/criada isoladamente; falhas são
 * acumuladas em `errors` sem abortar o restante. Códigos já cadastrados na
 * organização são pulados e contados em `skippedRows` (não há constraint única
 * de código no banco — a dedupe é feita aqui, como em Supplier/documento).
 * Linhas sem código são sempre criadas (não há como deduplicar). Atualiza os
 * contadores no `StoreImport` periodicamente para a UI acompanhar o progresso.
 */
export async function runStoreImport(importId: string): Promise<void> {
  const record = await prisma.storeImport.findUnique({
    where: { id: importId },
  });
  if (!record) throw new Error(`StoreImport ${importId} não encontrado`);

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

  await prisma.storeImport.update({
    where: { id: importId },
    data: { status: "PROCESSING", totalRows: rows.length },
  });

  // 3. Pré-carrega os códigos já cadastrados na org (para dedupe por código).
  const existing = await prisma.store.findMany({
    where: { organizationId: record.organizationId, code: { not: null } },
    select: { code: true },
  });
  const seenCodes = new Set(
    existing.map((s) => normalizeCode(s.code)).filter((c) => c.length > 0),
  );

  // 4. Processa linha a linha.
  const errors: RowError[] = [];
  let createdRows = 0;
  let skippedRows = 0;
  let processedRows = 0;

  for (let i = 0; i < rows.length; i++) {
    // +2: linha 1 é o cabeçalho; índice começa em 0 → número humano da planilha.
    const rowNumber = i + 2;
    try {
      const mapped = mapStoreRow(rows[i], mapping);
      if (mapped.error) {
        errors.push({ row: rowNumber, message: mapped.error });
      } else {
        const code = normalizeCode(mapped.input.code);
        // Código já visto (no banco ou em linha anterior): pula.
        if (code.length > 0 && seenCodes.has(code)) {
          skippedRows++;
        } else {
          await createStoreForOrg(mapped.input, {
            orgId: record.organizationId,
          });
          if (code.length > 0) seenCodes.add(code);
          createdRows++;
        }
      }
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    processedRows++;

    // Checkpoint de progresso a cada 25 linhas.
    if (processedRows % 25 === 0) {
      await prisma.storeImport.update({
        where: { id: importId },
        data: {
          processedRows,
          createdRows,
          skippedRows,
          failedRows: errors.length,
          errors: errors as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  // 5. Finaliza.
  await prisma.storeImport.update({
    where: { id: importId },
    data: {
      status: "COMPLETED",
      processedRows,
      createdRows,
      skippedRows,
      failedRows: errors.length,
      errors: errors as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
}
