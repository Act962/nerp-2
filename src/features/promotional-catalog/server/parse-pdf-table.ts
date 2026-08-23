import "server-only";

import { normHeader } from "../catalog-list-fields";
import { type ExtractedOffer, fillForward } from "./extract-offers-vision";

// Parser de TABELA em PDF pela camada de texto (sem IA). Muitos "encartes" na
// verdade são planilhas exportadas em PDF: têm texto selecionável organizado em
// colunas (Cliente | Produto | Preço | Data…). Ler esse texto e reconstruir as
// colunas dá contagem EXATA e determinística — e separa corretamente a coluna
// "Cliente" de outras (ex.: "Supervisão"), coisa que a IA de visão erra.
//
// Estratégia (genérica, não amarrada a um layout):
// 1) extrai itens de texto (x,y) por página;
// 2) agrupa em linhas por Y; linha "de dados" = tem uma célula com preço;
// 3) detecta as COLUNAS por picos de X (bordas onde começam células em quase
//    toda linha) — robusto a células multi-palavra;
// 4) classifica cada coluna por CONTEÚDO (preço, data, texto) e rotula as
//    colunas de texto pelo CABEÇALHO (Cliente/Departamento);
// 5) monta as ofertas. Se não achar produto+preço+cliente com confiança (ou o
//    PDF não tem texto — escaneado), retorna null e o chamador cai na IA.

type PItem = { x: number; y: number; s: string };

const Y_TOL = 4; // px: itens na mesma linha lógica
const X_MERGE = 12; // px: junta bins de X vizinhos numa coluna
const BIN = 2;

const PRICE_RE = /(?:r\$\s*)?\d{1,4}[.,]\d{2}\b/i;
const DATE_RE =
  /\b\d{1,2}[/.\- ](?:\d{1,2}|[a-zç]{3,})[/.\- ]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/i;

const MONTHS: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseNum(s: string): number | null {
  const c = s.replace(/[^0-9.,]/g, "");
  if (!c) return null;
  const n = Number(
    c.includes(",") ? c.replace(/\./g, "").replace(",", ".") : c,
  );
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  // dd/mmm/aa|aaaa (ex.: 06/ago/26)
  const mMonth = s.match(/^(\d{1,2})[/\- ]([a-zç]{3,})[/\- ](\d{2,4})$/);
  if (mMonth) {
    const mo = MONTHS[mMonth[2].slice(0, 3)];
    if (mo) {
      let y = Number(mMonth[3]);
      if (y < 100) y += 2000;
      return `${y}-${pad(mo)}-${pad(Number(mMonth[1]))}`;
    }
  }
  // dd/mm/aa|aaaa
  const mNum = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (mNum) {
    let y = Number(mNum[3]);
    if (y < 100) y += 2000;
    return `${y}-${pad(Number(mNum[2]))}-${pad(Number(mNum[1]))}`;
  }
  // aaaa-mm-dd
  const mIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mIso) {
    return `${mIso[1]}-${pad(Number(mIso[2]))}-${pad(Number(mIso[3]))}`;
  }
  return null;
}

// ── pdfjs: itens de texto por página (sem worker, roda no Node) ──
async function pdfTextPages(base64: string): Promise<PItem[][] | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(Buffer.from(base64, "base64"));
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false })
      .promise;
    const pages: PItem[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items: PItem[] = [];
      for (const raw of tc.items) {
        const it = raw as { str?: string; transform?: number[] };
        const s = (it.str ?? "").trim();
        if (!s || !it.transform) continue;
        items.push({ x: it.transform[4], y: it.transform[5], s });
      }
      pages.push(items);
    }
    return pages;
  } catch (error) {
    console.error("[parse-pdf-table] pdfjs falhou:", error);
    return null;
  }
}

// Agrupa itens de uma página em linhas (por Y), cada linha ordenada por X.
function groupRows(items: PItem[]): PItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PItem[][] = [];
  let cur: PItem[] = [];
  let curY = Number.POSITIVE_INFINITY;
  for (const it of sorted) {
    if (cur.length === 0) {
      cur = [it];
      curY = it.y;
    } else if (Math.abs(it.y - curY) <= Y_TOL) {
      cur.push(it);
    } else {
      rows.push(cur.sort((a, b) => a.x - b.x));
      cur = [it];
      curY = it.y;
    }
  }
  if (cur.length) rows.push(cur.sort((a, b) => a.x - b.x));
  return rows;
}

const isDataRow = (row: PItem[]) => row.some((it) => PRICE_RE.test(it.s));

// Índice da coluna a que um X pertence, dadas as fronteiras (midpoints).
function colIndex(x: number, bounds: number[]): number {
  let i = 0;
  while (i < bounds.length && x >= bounds[i]) i++;
  return i;
}

// Texto de cada coluna numa linha (junta itens da mesma banda).
function rowCells(row: PItem[], bounds: number[], nCols: number): string[] {
  const cells = new Array<string>(nCols).fill("");
  for (const it of row) {
    const ci = colIndex(it.x, bounds);
    cells[ci] = cells[ci] ? `${cells[ci]} ${it.s}` : it.s;
  }
  return cells.map((c) => c.replace(/\s+/g, " ").trim());
}

// Rótulos de cabeçalho → campo (só p/ colunas de texto: cliente/departamento).
const isClient = (n: string) =>
  ["cliente", "loja", "rede", "pdv", "estabelec", "unidade"].some((a) =>
    n.includes(a),
  );
const isDept = (n: string) =>
  ["departamento", "familia", "categoria", "setor", "secao", "linha"].some(
    (a) => n.includes(a),
  );
const isStart = (n: string) => n.includes("inicio") || n.includes("inicial");
const isEnd = (n: string) =>
  ["fim", "final", "termino", "validade", "venc", "ate"].some((a) =>
    n.includes(a),
  );
const isNormalPrice = (n: string) =>
  n.includes("normal") ||
  n.includes("cheio") ||
  n.includes("tabela") ||
  n === "de";
const isOfferPrice = (n: string) =>
  ["oferta", "promo", "por", "venda"].some((a) => n.includes(a));

// Detecta colunas por picos de X entre as linhas de dados.
function detectColumns(dataRows: PItem[][]): number[] {
  const nRows = dataRows.length;
  const freq = new Map<number, number>();
  for (const row of dataRows) {
    for (const it of row) {
      const k = Math.round(it.x / BIN) * BIN;
      freq.set(k, (freq.get(k) ?? 0) + 1);
    }
  }
  const minCount = Math.max(2, nRows * 0.35);
  const kept = [...freq.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => a[0] - b[0]);
  const cols: { x: number; c: number }[] = [];
  for (const [x, c] of kept) {
    const last = cols[cols.length - 1];
    if (last && x - last.x <= X_MERGE) {
      const total = last.c + c;
      last.x = Math.round((last.x * last.c + x * c) / total);
      last.c = total;
    } else {
      cols.push({ x, c });
    }
  }
  return cols.map((c) => c.x);
}

// Constrói ofertas a partir das páginas de texto. null = não é tabela legível.
function buildOffers(pages: PItem[][]): ExtractedOffer[] | null {
  // Linhas de dados de todas as páginas + linhas de cabeçalho da 1ª página.
  const perPageRows = pages.map(groupRows);
  const dataRows: PItem[][] = [];
  for (const rows of perPageRows)
    for (const r of rows) if (isDataRow(r)) dataRows.push(r);
  if (dataRows.length < 3) return null;

  const columnLefts = detectColumns(dataRows);
  if (columnLefts.length < 3) return null;
  const nCols = columnLefts.length;
  const bounds: number[] = [];
  for (let i = 0; i < nCols - 1; i++)
    bounds.push((columnLefts[i] + columnLefts[i + 1]) / 2);

  // Rótulos do cabeçalho (linhas acima da 1ª linha de dados da página 1).
  const page1 = perPageRows[0] ?? [];
  const firstDataIdx = page1.findIndex(isDataRow);
  const headerRows = firstDataIdx > 0 ? page1.slice(0, firstDataIdx) : [];
  const labels = new Array<string>(nCols).fill("");
  for (const hr of headerRows) {
    for (const it of hr) {
      const ci = colIndex(it.x, bounds);
      labels[ci] = `${labels[ci]} ${it.s}`.trim();
    }
  }
  const normLabels = labels.map(normHeader);

  // Estatística de conteúdo por coluna.
  const allCells: string[][] = dataRows.map((r) => rowCells(r, bounds, nCols));
  const stat = columnLefts.map((_, ci) => {
    const cells = allCells.map((c) => c[ci]).filter(Boolean);
    const n = cells.length || 1;
    const price = cells.filter((c) => PRICE_RE.test(c)).length / n;
    const date = cells.filter((c) => DATE_RE.test(c)).length / n;
    const avgLen = cells.reduce((a, c) => a + c.length, 0) / n;
    return { price, date, avgLen };
  });

  // Classificação de papéis.
  const used = new Array<boolean>(nCols).fill(false);
  let productCol = -1;
  let offerCol = -1;
  let normalCol = -1;
  let startCol = -1;
  let endCol = -1;
  let clientCol = -1;
  let deptCol = -1;

  // Datas (por conteúdo; ordena início/fim por cabeçalho, senão por posição).
  const dateCols = columnLefts
    .map((_, ci) => ci)
    .filter((ci) => stat[ci].date >= 0.6);
  for (const ci of dateCols) {
    if (isStart(normLabels[ci]) && startCol < 0) {
      startCol = ci;
      used[ci] = true;
    } else if (isEnd(normLabels[ci]) && endCol < 0) {
      endCol = ci;
      used[ci] = true;
    }
  }
  for (const ci of dateCols) {
    if (used[ci]) continue;
    if (startCol < 0) startCol = ci;
    else if (endCol < 0) endCol = ci;
    used[ci] = true;
  }

  // Preços (por conteúdo; normal/oferta por cabeçalho, senão esq=normal/dir=oferta).
  const priceCols = columnLefts
    .map((_, ci) => ci)
    .filter((ci) => !used[ci] && stat[ci].price >= 0.6);
  for (const ci of priceCols) {
    if (isNormalPrice(normLabels[ci]) && normalCol < 0) {
      normalCol = ci;
      used[ci] = true;
    } else if (isOfferPrice(normLabels[ci]) && offerCol < 0) {
      offerCol = ci;
      used[ci] = true;
    }
  }
  const restPrice = priceCols.filter((ci) => !used[ci]);
  if (offerCol < 0 && restPrice.length === 1) {
    offerCol = restPrice[0];
    used[offerCol] = true;
  } else if (restPrice.length >= 2) {
    if (normalCol < 0) {
      normalCol = restPrice[0];
      used[normalCol] = true;
    }
    if (offerCol < 0) {
      offerCol = restPrice[restPrice.length - 1];
      used[offerCol] = true;
    }
  }

  // Produto = coluna de texto restante com maior comprimento médio.
  let bestLen = 4;
  columnLefts.forEach((_, ci) => {
    if (used[ci]) return;
    if (stat[ci].avgLen > bestLen) {
      bestLen = stat[ci].avgLen;
      productCol = ci;
    }
  });
  if (productCol >= 0) used[productCol] = true;

  // Cliente e departamento pelas colunas de texto restantes (via cabeçalho).
  const textCols = columnLefts.map((_, ci) => ci).filter((ci) => !used[ci]);
  for (const ci of textCols) {
    if (clientCol < 0 && isClient(normLabels[ci])) clientCol = ci;
    else if (deptCol < 0 && isDept(normLabels[ci])) deptCol = ci;
  }
  // Sem cabeçalho de cliente, mas há exatamente uma coluna de texto sobrando:
  // assume que é o cliente.
  if (clientCol < 0) {
    const remaining = textCols.filter((ci) => ci !== deptCol);
    if (remaining.length === 1) clientCol = remaining[0];
  }

  if (productCol < 0 || offerCol < 0 || clientCol < 0) return null;

  const offers: ExtractedOffer[] = [];
  for (const cells of allCells) {
    const productName = cells[productCol]?.trim();
    if (!productName) continue;
    const offerPrice = parseNum(cells[offerCol] ?? "");
    offers.push({
      client: clientCol >= 0 ? cells[clientCol]?.trim() || null : null,
      productName,
      normalPrice: normalCol >= 0 ? parseNum(cells[normalCol] ?? "") : null,
      offerPrice,
      department: deptCol >= 0 ? cells[deptCol]?.trim() || null : null,
      startDate: startCol >= 0 ? parseDate(cells[startCol] ?? "") : null,
      endDate: endCol >= 0 ? parseDate(cells[endCol] ?? "") : null,
    });
  }
  if (offers.length === 0) return null;
  return fillForward(offers);
}

// Ponto de entrada: tenta ler a tabela do PDF pela camada de texto.
export async function parsePdfTable(
  base64: string,
): Promise<ExtractedOffer[] | null> {
  const pages = await pdfTextPages(base64);
  if (!pages) return null;
  const totalItems = pages.reduce((a, p) => a + p.length, 0);
  if (totalItems < 10) return null; // PDF escaneado / sem texto
  return buildOffers(pages);
}
