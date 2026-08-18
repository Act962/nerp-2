import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { resolveDirectoryStore } from "@/app/router/field-map/_resolve-directory-store";
import { normalizeCity, normalizeStoreName } from "@/lib/store-name";
import { findTakenSlugs, storeSlugCandidates } from "@/lib/store-slug";
import { S3 } from "@/lib/s3-client";
import type { ImportMapping } from "@/features/stores/import-fields";
import { createStoreForOrg } from "./create-store-for-org";
import { mapStoreRow, parseSheet, type SheetRow } from "./parse-store-import";

interface RowError {
  row: number;
  message: string;
}

/**
 * Linhas por lote. Cada lote é um `step.run` do Inngest, e um step precisa
 * caber numa invocação serverless — o teto não é generoso. 500 linhas a uma
 * ida ao banco cada terminam em segundos, com folga para o banco estar lento.
 */
export const CHUNK_ROWS = 500;

/**
 * Teto de ocorrências guardadas no registro. Numa lista de clientes quase toda
 * linha vira "ignorada", e o array é regravado inteiro a cada lote: sem teto o
 * volume de escrita cresce com o quadrado do arquivo, e a UI ainda tentaria
 * renderizar uma tabela de 15 mil linhas.
 */
const MAX_STORED_OCCURRENCES = 500;

export interface StoreImportChunkResult {
  /** Índice da primeira linha do próximo lote. */
  nextOffset: number;
  /** Não há mais linhas — a importação foi finalizada. */
  done: boolean;
}

/** Código normalizado (trim + maiúsculas) — usado para comparar duplicados. */
function normalizeCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

/**
 * Processa UM lote de linhas de uma importação de lojas.
 *
 * O trabalho é fatiado porque a importação inteira num passo só não cabe na
 * invocação: um arquivo de 15 mil clientes estourava o tempo, o step nunca era
 * memoizado, e o Inngest reexecutava tudo desde a primeira linha — a
 * importação parecia "voltar" sozinha até esgotar as tentativas e falhar. Com
 * o lote, uma falha reexecuta no máximo `CHUNK_ROWS` linhas.
 *
 * Reprocessar um lote é seguro: a dedupe abaixo reconhece o que a tentativa
 * anterior já gravou e pula. Os contadores são somados uma única vez, no fim do
 * lote — lote que morre no meio não conta nada, e a retentativa recontabiliza
 * as mesmas linhas (as já criadas entram como ignoradas).
 *
 * Importação parcial: cada linha é validada/criada isoladamente; falhas são
 * acumuladas em `errors` sem abortar o restante.
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
export async function runStoreImportChunk(
  importId: string,
  offset: number,
): Promise<StoreImportChunkResult> {
  const record = await prisma.storeImport.findUnique({
    where: { id: importId },
  });
  if (!record) throw new Error(`StoreImport ${importId} não encontrado`);

  const mapping = record.mapping as ImportMapping;

  // 1. Baixa o arquivo do S3. Cada lote roda numa invocação própria, sem
  //    memória compartilhada, então o download se repete — é barato perto de
  //    manter 15 mil linhas parseadas no estado do Inngest.
  const object = await S3.send(
    new GetObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
      Key: record.fileKey,
    }),
  );
  const bytes = await object.Body?.transformToByteArray();
  if (!bytes) throw new Error("Arquivo de importação vazio ou inacessível");
  const buffer = Buffer.from(bytes);

  // 2. Parseia as linhas e recorta o lote.
  const rows: SheetRow[] = parseSheet(buffer);
  const slice = rows.slice(offset, offset + CHUNK_ROWS);

  if (offset === 0) {
    // Zera os contadores: se o primeiro lote falhou e voltou, somar por cima do
    // que ficou daria um progresso maior que o arquivo.
    await prisma.storeImport.update({
      where: { id: importId },
      data: {
        status: "PROCESSING",
        totalRows: rows.length,
        processedRows: 0,
        createdRows: 0,
        skippedRows: 0,
        failedRows: 0,
        errors: [],
      },
    });
  }

  if (slice.length === 0) {
    await finalize(importId, offset);
    return { nextOffset: offset, done: true };
  }

  const toCatalog = record.target === "CATALOGO";
  const mapped = slice.map((row) => mapStoreRow(row, mapping));

  // 3. Pré-carrega o que já existe na org, para as duas chaves de dedupe. Os
  //    lotes anteriores já gravaram, então isto também cobre a dedupe entre
  //    lotes.
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

  // 4. Pré-carrega os slugs disputados do lote. Duas consultas para o lote
  //    inteiro, no lugar de duas por linha. Só os candidatos preferidos entram
  //    aqui; os sufixados caem no índice único, que é quem arbitra de verdade.
  const takenSlugs = toCatalog
    ? new Set<string>()
    : await findTakenSlugs(
        mapped
          .filter((m) => !m.error)
          .flatMap((m) =>
            storeSlugCandidates(m.input.name, m.input.city).slice(0, 2),
          ),
      );

  const pickSlug = (name: string, city?: string | null): string | null => {
    for (const candidate of storeSlugCandidates(name, city)) {
      if (takenSlugs.has(candidate)) continue;
      takenSlugs.add(candidate);
      return candidate;
    }
    return null;
  };

  // 5. Processa linha a linha.
  const errors: RowError[] = [];
  /** Duplicadas: aparecem na mesma lista, mas NÃO contam como falha. */
  const skips: RowError[] = [];
  let createdRows = 0;
  let skippedRows = 0;

  for (let i = 0; i < slice.length; i++) {
    // +2: linha 1 é o cabeçalho; índice começa em 0 → número humano da planilha.
    const rowNumber = offset + i + 2;
    try {
      const row = mapped[i];
      if (row.error) {
        errors.push({ row: rowNumber, message: row.error });
      } else {
        const code = normalizeCode(row.input.code);
        const { name, city } = row.input;

        if (toCatalog) {
          const resolved = await resolveDirectoryStore({
            name,
            document: row.input.document,
            address: row.input.address,
            suburb: row.input.suburb,
            city,
            state: row.input.state,
            postcode: row.input.postcode,
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
          await createStoreForOrg(row.input, {
            orgId: record.organizationId,
            slug: pickSlug(name, city),
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
  }

  // 6. Fecha o lote num único write. Somar em vez de gravar o total absoluto é
  //    o que torna a retentativa segura: quem morre antes daqui não contabiliza.
  // No primeiro lote os contadores foram zerados acima — as ocorrências lidas
  // junto com o registro são de uma tentativa anterior e não valem mais.
  const stored =
    offset === 0 ? [] : ((record.errors ?? []) as unknown as RowError[]);
  await prisma.storeImport.update({
    where: { id: importId },
    data: {
      processedRows: { increment: slice.length },
      createdRows: { increment: createdRows },
      skippedRows: { increment: skippedRows },
      failedRows: { increment: errors.length },
      errors: [...stored, ...errors, ...skips].slice(
        0,
        MAX_STORED_OCCURRENCES,
      ) as unknown as Prisma.InputJsonValue,
    },
  });

  const nextOffset = offset + slice.length;
  const done = nextOffset >= rows.length;
  if (done) await finalize(importId, nextOffset);

  return { nextOffset, done };
}

async function finalize(importId: string, processedRows: number) {
  await prisma.storeImport.update({
    where: { id: importId },
    data: {
      status: "COMPLETED",
      processedRows,
      completedAt: new Date(),
    },
  });
}
