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
