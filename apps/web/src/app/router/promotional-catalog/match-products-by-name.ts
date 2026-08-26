import prisma from "@/lib/db";
import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requireAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import {
  codeCandidates,
  normalizeCode,
  normalizeName,
} from "@/features/promotional-catalog/lib/product-match";

// Casa linhas da aba "Lista" com produtos do cadastro, para trazer a imagem.
//
// Cascata (a primeira que resolver vence):
//   1. barcode  — exato, em lote. `@@unique([organizationId, barcode])` ⇒ nunca ambíguo.
//   2. sku      — exato, em lote. Sem unique ⇒ pode ser ambíguo.
//   3. nome completo normalizado — exato (sem acento/pontuação).
//   4. prefixo (2 primeiras palavras) — o comportamento HISTÓRICO, mantido
//      byte a byte: mesma query, mesmo `orderBy`, mesmo primeiro resultado.
//
// Compatibilidade: `names` continua funcionando e a resposta continua trazendo
// os mesmos 4 campos de sempre. `items`/`code` e os campos de diagnóstico
// (`source`, `ambiguous`, `alternatives`) são adições opcionais.

function searchKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 2)
    .join(" ")
    .trim();
}

type Candidate = { id: string; name: string; thumbnail: string | null };

type MatchResult = {
  name: string;
  code?: string;
  productId: string | null;
  matchedName: string | null;
  thumbnail: string | null;
  source: "barcode" | "sku" | "name-exact" | "name-prefix" | null;
  ambiguous: boolean;
  alternatives: Candidate[];
};

const EMPTY = {
  productId: null,
  matchedName: null,
  thumbnail: null,
  source: null,
  ambiguous: false,
  alternatives: [] as Candidate[],
};

export const matchProductsByName = base
  .use(requireAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    summary: "Casar produtos da lista com o cadastro (código ou nome)",
    tags: ["promotional-catalog"],
  })
  .input(
    z.object({
      // Forma histórica — segue aceita.
      names: z.array(z.string()).max(500).optional(),
      // Forma nova: permite mandar o código junto do nome.
      items: z
        .array(
          z.object({
            name: z.string(),
            code: z.string().optional().nullable(),
          }),
        )
        .max(500)
        .optional(),
    }),
  )
  .output(
    z.array(
      z.object({
        name: z.string(),
        code: z.string().optional(),
        productId: z.string().nullable(),
        matchedName: z.string().nullable(),
        thumbnail: z.string().nullable(),
        source: z
          .enum(["barcode", "sku", "name-exact", "name-prefix"])
          .nullable(),
        ambiguous: z.boolean(),
        alternatives: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            thumbnail: z.string().nullable(),
          }),
        ),
      }),
    ),
  )
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;
    const entries: { name: string; code?: string | null }[] = input.items
      ?.length
      ? input.items
      : (input.names ?? []).map((name) => ({ name }));
    if (entries.length === 0) return [];

    const results: MatchResult[] = entries.map((e) => ({
      name: e.name,
      ...(e.code ? { code: e.code } : {}),
      ...EMPTY,
    }));

    // ── Tiers 1 e 2: código, resolvidos em UMA query para o lote inteiro ──
    const perEntryCandidates = entries.map((e) => codeCandidates(e.code));
    const allCandidates = [...new Set(perEntryCandidates.flat())];

    const byBarcode = new Map<string, Candidate>();
    const bySku = new Map<string, Candidate[]>();

    if (allCandidates.length > 0) {
      const rows = await prisma.product.findMany({
        where: {
          organizationId: orgId,
          isActive: true,
          OR: [
            { barcode: { in: allCandidates } },
            { sku: { in: allCandidates } },
          ],
        },
        select: {
          id: true,
          name: true,
          thumbnail: true,
          barcode: true,
          sku: true,
        },
      });
      for (const row of rows) {
        const candidate: Candidate = {
          id: row.id,
          name: row.name,
          thumbnail: row.thumbnail || null,
        };
        const barcode = normalizeCode(row.barcode);
        if (barcode && !byBarcode.has(barcode))
          byBarcode.set(barcode, candidate);
        const sku = normalizeCode(row.sku);
        if (sku) bySku.set(sku, [...(bySku.get(sku) ?? []), candidate]);
      }
    }

    // Índices que sobraram para o casamento por nome.
    const pendingByName: number[] = [];

    entries.forEach((_entry, i) => {
      const candidates = perEntryCandidates[i];

      for (const code of candidates) {
        const hit = byBarcode.get(code);
        if (hit) {
          results[i] = {
            ...results[i],
            productId: hit.id,
            matchedName: hit.name,
            thumbnail: hit.thumbnail,
            source: "barcode",
            ambiguous: false,
            alternatives: [],
          };
          return;
        }
      }

      for (const code of candidates) {
        const hits = bySku.get(code);
        if (hits && hits.length > 0) {
          results[i] = {
            ...results[i],
            productId: hits[0].id,
            matchedName: hits[0].name,
            thumbnail: hits[0].thumbnail,
            source: "sku",
            ambiguous: hits.length > 1,
            alternatives: hits.slice(1, 6),
          };
          return;
        }
      }

      pendingByName.push(i);
    });

    // ── Tiers 3 e 4: nome. Uma query por linha, em blocos de 8 (como antes) ──
    const CHUNK = 8;
    for (let i = 0; i < pendingByName.length; i += CHUNK) {
      const slice = pendingByName.slice(i, i + CHUNK);
      await Promise.all(
        slice.map(async (index) => {
          const rawName = entries[index].name;
          const key = searchKey(rawName);
          if (!key) return;

          // `orderBy` idêntico ao histórico: `rows[0]` é exatamente o produto
          // que o `findFirst` antigo devolvia. O `take` só limita o leque de
          // alternativas — não muda a escolha.
          const rows = await prisma.product.findMany({
            where: {
              organizationId: orgId,
              isActive: true,
              name: { contains: key, mode: "insensitive" as const },
            },
            select: { id: true, name: true, thumbnail: true },
            orderBy: { name: "asc" },
            take: 50,
          });
          if (rows.length === 0) return;

          const candidates: Candidate[] = rows.map((r) => ({
            id: r.id,
            name: r.name,
            thumbnail: r.thumbnail || null,
          }));

          const target = normalizeName(rawName);
          const exact = candidates.find(
            (c) => normalizeName(c.name) === target,
          );
          const chosen = exact ?? candidates[0];

          results[index] = {
            ...results[index],
            productId: chosen.id,
            matchedName: chosen.name,
            thumbnail: chosen.thumbnail,
            source: exact ? "name-exact" : "name-prefix",
            ambiguous: !exact && candidates.length > 1,
            alternatives: exact
              ? []
              : candidates.filter((c) => c.id !== chosen.id).slice(0, 5),
          };
        }),
      );
    }

    return results;
  });
