// Normalização compartilhada entre a planilha (cliente) e o casamento com o
// cadastro (servidor). Módulo PURO: sem prisma, sem React — os dois lados
// precisam gerar exatamente a mesma chave, senão o match silenciosamente erra.

/**
 * O Excel guarda EAN de 13 dígitos como número e, na leitura com
 * `{ raw: false }`, devolve "7,89123E+12". Os dígitos JÁ se perderam nesse
 * ponto — não dá pra "expandir" de volta. Detectamos para avisar o usuário
 * ("formate a coluna como Texto") em vez de gravar um código lixo.
 */
export function isScientificNotation(raw: string): boolean {
  return /^\s*\d+([.,]\d+)?\s*e\s*\+?\s*\d+\s*$/i.test(raw);
}

/** Só alfanumérico, maiúsculo. Vazio quando o valor é inaproveitável. */
export function normalizeCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s || isScientificNotation(s)) return "";
  return s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Variações plausíveis do mesmo código: o Excel come zero à esquerda, e a
 * mesma mercadoria aparece ora como EAN-13, ora como DUN-14 (com zero na
 * frente). Testar as variações evita "não encontrado" bobo.
 */
export function codeCandidates(raw: string | null | undefined): string[] {
  const base = normalizeCode(raw);
  if (!base) return [];
  const out = new Set<string>([base]);
  const stripped = base.replace(/^0+/, "");
  if (stripped) out.add(stripped);
  // Só re-preenche quando é código puramente numérico (EAN/DUN).
  if (/^\d+$/.test(stripped)) {
    if (stripped.length < 13) out.add(stripped.padStart(13, "0"));
    if (stripped.length < 14) out.add(stripped.padStart(14, "0"));
  }
  return [...out];
}

/** Sem acento, maiúsculo, pontuação virando espaço único. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * Identidade de uma linha da planilha para dedup/cache de match.
 * SEM código, cai no nome normalizado — que é como o fluxo atual já agrupa,
 * então planilha sem a coluna nova se comporta exatamente como hoje.
 */
export function matchKey(item: {
  productName: string;
  code?: string | null;
}): string {
  const code = normalizeCode(item.code);
  return code ? `c:${code}` : `n:${normalizeName(item.productName)}`;
}

/** Como o produto foi encontrado — vira o selo de confiança na tabela. */
export type MatchSource =
  | "barcode"
  | "sku"
  | "name-exact"
  | "name-prefix"
  | "manual";

/** Match por código (exato) é confiável; por prefixo do nome, é um palpite. */
export function isReliableMatch(source: MatchSource | null | undefined) {
  return (
    source === "barcode" ||
    source === "sku" ||
    source === "name-exact" ||
    source === "manual"
  );
}

// ── Casamento por nome ─────────────────────────────────────────────────────
// Roda em JS sobre os nomes normalizados dos DOIS lados. Fazer `contains` de um
// termo já sem acento/pontuação contra a coluna crua do Postgres nunca casa —
// "CAFES CAFE" não é substring de "Cafes - Café Santa Clara 250G" —, e era esse
// o bug: planilha com o nome IDÊNTICO ao cadastro voltava como "novo".

const NAME_STOPWORDS = new Set([
  "DE",
  "DA",
  "DO",
  "DAS",
  "DOS",
  "E",
  "COM",
  "SEM",
  "PARA",
]);

// Unidade de medida → forma canônica: "300 GR" e "300G" são a mesma coisa.
const UNIT_ALIASES = new Map<string, string>([
  ["G", "G"],
  ["GR", "G"],
  ["GRS", "G"],
  ["GRAMA", "G"],
  ["GRAMAS", "G"],
  ["KG", "KG"],
  ["MG", "MG"],
  ["ML", "ML"],
  ["L", "L"],
  ["LT", "L"],
  ["LTS", "L"],
  ["LITRO", "L"],
  ["LITROS", "L"],
  ["UN", "UN"],
  ["UND", "UN"],
  ["UNID", "UN"],
  ["UNIDADE", "UN"],
  ["CX", "CX"],
  ["PC", "PC"],
  ["PCT", "PC"],
]);

/** Palavras significativas do nome (sem acento, pontuação ou palavra vazia). */
export function nameTokens(raw: string | null | undefined): string[] {
  const norm = normalizeName(raw);
  if (!norm) return [];
  return norm.split(" ").filter((t) => t && !NAME_STOPWORDS.has(t));
}

/** Nome quebrado em palavras + a gramatura, que é comparada à parte. */
export type NameParts = { tokens: string[]; size: string | null };

/**
 * Separa a gramatura/volume do resto do nome ("250G", "1L"; "300 gr" → "300G").
 * É o que distingue variações de um mesmo produto: sem isso o achocolatado de
 * 400G casa com o de 700G, cujo nome só difere nesse pedaço.
 */
export function parseName(raw: string | null | undefined): NameParts {
  const all = nameTokens(raw);
  for (let i = 0; i < all.length; i++) {
    const m = all[i].match(/^(\d+(?:[.,]\d+)?)([A-Z]*)$/);
    if (!m) continue;
    const inline = m[2];
    const canon = UNIT_ALIASES.get(inline || all[i + 1] || "");
    if (!canon) continue;
    const value = Number(m[1].replace(",", "."));
    if (!Number.isFinite(value)) continue;
    return {
      tokens: [...all.slice(0, i), ...all.slice(i + (inline ? 1 : 2))],
      size: `${value}${canon}`,
    };
  }
  return { tokens: all, size: null };
}

/**
 * Similaridade de Dice entre as palavras (0..1). Gramatura diferente ZERA: são
 * produtos distintos, não um palpite bom.
 */
export function nameSimilarity(a: NameParts, b: NameParts): number {
  if (a.size && b.size && a.size !== b.size) return 0;
  const setA = new Set(a.tokens);
  const setB = new Set(b.tokens);
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return (2 * inter) / (setA.size + setB.size);
}

/**
 * Piso do palpite por palavras. Calibrado com o encarte real: "Soluveis -
 * Santa Clara - Refil - 40G" contra "Soluveis - Kimimo - Refil - 40G" dá 0,57
 * (marca diferente, tem que recusar) e um nome só sem o prefixo de categoria
 * dá 0,9 (tem que aceitar).
 */
export const MIN_NAME_SCORE = 0.7;

export type MatchableProduct = { id: string; name: string };

export type ProductNameIndex<P extends MatchableProduct> = {
  byNorm: Map<string, P[]>;
  byToken: Map<string, P[]>;
  parts: Map<string, NameParts>;
};

/** Índice em memória do cadastro da org — montado uma vez por importação. */
export function indexProducts<P extends MatchableProduct>(
  products: P[],
): ProductNameIndex<P> {
  const index: ProductNameIndex<P> = {
    byNorm: new Map(),
    byToken: new Map(),
    parts: new Map(),
  };
  for (const p of products) {
    const norm = normalizeName(p.name);
    if (norm) {
      const bucket = index.byNorm.get(norm);
      if (bucket) bucket.push(p);
      else index.byNorm.set(norm, [p]);
    }
    const parsed = parseName(p.name);
    index.parts.set(p.id, parsed);
    for (const token of new Set(parsed.tokens)) {
      const bucket = index.byToken.get(token);
      if (bucket) bucket.push(p);
      else index.byToken.set(token, [p]);
    }
  }
  return index;
}

export type NameLookup<P> = {
  product: P;
  exact: boolean;
  score: number;
  ambiguous: boolean;
  alternatives: P[];
};

/**
 * Acha o produto do cadastro para um nome da planilha: exato pelo nome
 * normalizado e, na falta dele, o melhor palpite por palavras acima do piso.
 */
export function lookupByName<P extends MatchableProduct>(
  index: ProductNameIndex<P>,
  rawName: string,
): NameLookup<P> | null {
  const norm = normalizeName(rawName);
  if (!norm) return null;

  const exact = index.byNorm.get(norm);
  if (exact?.length) {
    return {
      product: exact[0],
      exact: true,
      score: 1,
      // Mais de um produto com o MESMO nome normalizado é duplicata no
      // cadastro ("...700G" e "...700g"): casa no primeiro e mostra o resto.
      ambiguous: exact.length > 1,
      alternatives: exact.slice(1, 6),
    };
  }

  const target = parseName(rawName);
  if (target.tokens.length === 0) return null;

  // Só entram no ranking os produtos que dividem ao menos uma palavra — evita
  // varrer o cadastro inteiro por linha da planilha.
  const seen = new Set<string>();
  const scored: { product: P; score: number }[] = [];
  for (const token of new Set(target.tokens)) {
    for (const p of index.byToken.get(token) ?? []) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const parts = index.parts.get(p.id) ?? parseName(p.name);
      const score = nameSimilarity(target, parts);
      if (score >= MIN_NAME_SCORE) scored.push({ product: p, score });
    }
  }
  if (scored.length === 0) return null;

  scored.sort(
    (a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name),
  );
  const [best, runnerUp] = scored;
  return {
    product: best.product,
    exact: false,
    score: best.score,
    ambiguous: !!runnerUp && best.score - runnerUp.score < 0.05,
    alternatives: scored.slice(1, 6).map((s) => s.product),
  };
}
