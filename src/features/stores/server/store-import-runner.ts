import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { resolveDirectoryStore } from "@/app/router/field-map/_resolve-directory-store";
import { normalizeCity, normalizeStoreName } from "@/lib/store-name";
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
 * acumuladas em `errors` sem abortar o restante. Atualiza os contadores no
 * `StoreImport` periodicamente para a UI acompanhar o progresso.
 *
 * A dedupe tem DUAS chaves, e a segunda existe porque a primeira não cobre o
 * caso real: o código só pega planilha que traz código, e as listas de cliente
 * quase nunca trazem. Sem a segunda chave, importar a própria lista por cima
 * dos clientes que vieram do OpenStreetMap criaria um segundo cadastro da mesma
 * loja — e aí o promotor vê dois pinos e as fotos se dividem entre eles.
 *
 * 1. **Código** (quando existe): igualdade exata, normalizada.
 * 2. **Nome + cidade**: nome reduzido ao que identifica ("Supermercado Coelho"
 *    e "MERCADO COELHO LTDA" são o mesmo). Cidades diferentes NÃO são
 *    duplicata — é filial. Cidade ausente de um dos lados conta como duplicata,
 *    de propósito: pular é visível na lista de ocorrências e reversível;
 *    duplicar passa despercebido e é caro de desfazer.
 *
 * Com `target: CATALOGO` as linhas vão para o catálogo NACIONAL em vez da
 * carteira: viram PDVs do mapa do Brasil, sem dono. Aí a dedupe é a de
 * `resolveDirectoryStore` — CNPJ do estabelecimento primeiro, que é exato —, e
 * a coordenada NÃO é exigida: quem fixa o pino é a primeira foto de um promotor
 * na porta da loja.
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

  const toCatalog = record.target === "CATALOGO";

  // 3. Pré-carrega o que já existe na org, para as duas chaves de dedupe.
  const existing = await prisma.store.findMany({
    where: { organizationId: record.organizationId },
    select: { name: true, code: true, city: true },
  });
  const seenCodes = new Set(
    existing.map((s) => normalizeCode(s.code)).filter((c) => c.length > 0),
  );
  /** nome normalizado → cidades onde ele já existe ("" = sem cidade). */
  const seenNames = new Map<string, Set<string>>();
  const rememberName = (name: string, city: string | null | undefined) => {
    const key = normalizeStoreName(name);
    if (!key) return;
    const cities = seenNames.get(key) ?? new Set<string>();
    cities.add(normalizeCity(city));
    seenNames.set(key, cities);
  };
  for (const store of existing) rememberName(store.name, store.city);

  const duplicateName = (
    name: string,
    city: string | null | undefined,
  ): boolean => {
    const cities = seenNames.get(normalizeStoreName(name));
    if (!cities) return false;
    const target = normalizeCity(city);
    // Sem cidade de um dos lados não dá para afirmar que é outra praça.
    if (target === "" || cities.has("")) return true;
    return cities.has(target);
  };

  // 4. Processa linha a linha.
  const errors: RowError[] = [];
  /** Duplicadas: aparecem na mesma lista, mas NÃO contam como falha. */
  const skips: RowError[] = [];
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
        const { name, city } = mapped.input;

        if (toCatalog) {
          const resolved = await resolveDirectoryStore({
            name,
            document: mapped.input.document,
            address: mapped.input.address,
            suburb: mapped.input.suburb,
            city,
            state: mapped.input.state,
            postcode: mapped.input.postcode,
            source: "IMPORTACAO",
            sourceOrgId: record.organizationId,
          });
          if (!resolved) {
            skippedRows++;
            skips.push({
              row: rowNumber,
              message: `Ignorada: "${name}" sem CNPJ e sem coordenada — não há como identificar o ponto`,
            });
          } else if (resolved.created) {
            createdRows++;
          } else {
            skippedRows++;
            skips.push({
              row: rowNumber,
              message: `Ignorada: "${name}" já está no catálogo nacional`,
            });
          }
        } else if (code.length > 0 && seenCodes.has(code)) {
          // Código já visto (no banco ou em linha anterior): pula.
          skippedRows++;
          skips.push({
            row: rowNumber,
            message: `Ignorada: já existe cliente com o código ${code}`,
          });
        } else if (duplicateName(name, city)) {
          skippedRows++;
          skips.push({
            row: rowNumber,
            message: `Ignorada: "${name}"${city ? ` (${city})` : ""} parece já cadastrado. Informe um código na planilha para importar mesmo assim.`,
          });
        } else {
          await createStoreForOrg(mapped.input, {
            orgId: record.organizationId,
          });
          if (code.length > 0) seenCodes.add(code);
          // A própria planilha pode repetir a mesma loja em duas linhas.
          rememberName(name, city);
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
          errors: [...errors, ...skips] as unknown as Prisma.InputJsonValue,
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
      errors: [...errors, ...skips] as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
}
