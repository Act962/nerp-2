import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { S3 } from "@/lib/s3-client";
import type { ImportMapping } from "@/features/custom/import-fields";
import { createCustomerForOrg } from "./create-customer-for-org";
import { mapCustomerRow, parseSheet, type SheetRow } from "./parse-customer-import";

interface RowError {
  row: number;
  message: string;
}

/** Email normalizado (trim + lowercase) — usado para comparar duplicados. */
function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Baixa o arquivo do S3 (CSV/XLSX), parseia e cria os clientes linha a linha.
 *
 * Importação parcial: cada linha é validada/criada isoladamente; falhas são
 * acumuladas em `errors` sem abortar o restante. Emails já cadastrados na
 * organização são pulados e contados em `skippedRows` (o email é a chave única
 * do cliente). Atualiza os contadores no `CustomerImport` periodicamente para a
 * UI acompanhar o progresso.
 */
export async function runCustomerImport(importId: string): Promise<void> {
  const record = await prisma.customerImport.findUnique({
    where: { id: importId },
  });
  if (!record) throw new Error(`CustomerImport ${importId} não encontrado`);

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

  await prisma.customerImport.update({
    where: { id: importId },
    data: { status: "PROCESSING", totalRows: rows.length },
  });

  // 3. Pré-carrega os emails já cadastrados na org (para dedupe por email).
  const existing = await prisma.customer.findMany({
    where: { organizationId: record.organizationId },
    select: { email: true },
  });
  const seenEmails = new Set(
    existing
      .map((c) => normalizeEmail(c.email))
      .filter((e) => e.length > 0),
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
      const mapped = mapCustomerRow(rows[i], mapping);
      if (mapped.error) {
        errors.push({ row: rowNumber, message: mapped.error });
      } else {
        const email = normalizeEmail(mapped.input.email);
        // Email já visto (no banco ou em linha anterior): pula.
        if (email.length > 0 && seenEmails.has(email)) {
          skippedRows++;
        } else {
          await createCustomerForOrg(mapped.input, {
            orgId: record.organizationId,
          });
          if (email.length > 0) seenEmails.add(email);
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
      await prisma.customerImport.update({
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
  await prisma.customerImport.update({
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
