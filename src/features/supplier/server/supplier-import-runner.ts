import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { S3 } from "@/lib/s3-client";
import type { ImportMapping } from "@/features/supplier/import-fields";
import { createSupplierForOrg } from "./create-supplier-for-org";
import {
  mapSupplierRow,
  parseSheet,
  type SheetRow,
} from "./parse-supplier-import";

interface RowError {
  row: number;
  message: string;
}

/** Apenas os dígitos do documento — usado para comparar duplicados. */
function documentDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Baixa o arquivo do S3 (CSV/XLSX), parseia e cria os fornecedores linha a linha.
 *
 * Importação parcial: cada linha é validada/criada isoladamente; falhas são
 * acumuladas em `errors` sem abortar o restante. Documentos (CPF/CNPJ) já
 * cadastrados na organização são pulados e contados em `skippedRows`. Atualiza os
 * contadores no `SupplierImport` periodicamente para a UI acompanhar o progresso.
 */
export async function runSupplierImport(importId: string): Promise<void> {
  const record = await prisma.supplierImport.findUnique({
    where: { id: importId },
  });
  if (!record) throw new Error(`SupplierImport ${importId} não encontrado`);

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

  await prisma.supplierImport.update({
    where: { id: importId },
    data: { status: "PROCESSING", totalRows: rows.length },
  });

  // 3. Pré-carrega os documentos já cadastrados na org (para dedupe por documento).
  const existing = await prisma.supplier.findMany({
    where: { organizationId: record.organizationId, document: { not: null } },
    select: { document: true },
  });
  const seenDocuments = new Set(
    existing.map((s) => documentDigits(s.document)).filter((d) => d.length > 0),
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
      const mapped = mapSupplierRow(rows[i], mapping);
      if (mapped.error) {
        errors.push({ row: rowNumber, message: mapped.error });
      } else {
        const digits = documentDigits(mapped.input.document);
        // Documento não-vazio já visto (no banco ou em linha anterior): pula.
        if (digits.length > 0 && seenDocuments.has(digits)) {
          skippedRows++;
        } else {
          await createSupplierForOrg(mapped.input, {
            orgId: record.organizationId,
          });
          if (digits.length > 0) seenDocuments.add(digits);
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
      await prisma.supplierImport.update({
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
  await prisma.supplierImport.update({
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
