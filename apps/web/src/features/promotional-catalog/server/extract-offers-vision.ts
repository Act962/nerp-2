import "server-only";

import { PDFDocument } from "pdf-lib";

// Extração de ofertas de um ENCARTE (imagem ou PDF) por IA. Suporta dois
// provedores (REST puro, sem SDK): OpenAI (preferido, se OPENAI_API_KEY) e Google
// Gemini (GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY). Sem nenhuma chave
// válida → retorna null e a UI cai no caminho da planilha.
//
// PRECISÃO: PDFs são quebrados PÁGINA A PÁGINA (pdf-lib) e cada página é extraída
// isoladamente. Uma passada única sobre um encarte denso trunca/omite itens de
// forma não-determinística (55 numa vez, 22 na outra); página a página o modelo
// tem uma tarefa pequena e completa, e o total fica estável. Depois um passe de
// "forward-fill" propaga o CLIENTE e a VALIDADE do cabeçalho da seção para os
// itens seguintes (encarte lista o cliente/período uma vez por seção).

const OPENAI_MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
const GEMINI_MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-2.0-flash";
const PAGE_CONCURRENCY = 4;

function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

export interface ExtractedOffer {
  client: string | null;
  productName: string;
  normalPrice: number | null;
  offerPrice: number | null;
  department: string | null;
  startDate: string | null;
  endDate: string | null;
}

// O texto do prompt injeta a data de hoje para resolver anos ausentes (ex.:
// "06 a 16.08" sem ano → usa o ano corrente).
function buildPrompt(today: string): string {
  return `Você recebe UMA página de um ENCARTE de ofertas de supermercado (imagem ou PDF). A página pode ter um ou mais clientes/lojas, cada um com vários produtos.

REGRA DE OURO — COMPLETUDE: extraia TODOS os produtos com preço visíveis nesta página, SEM OMITIR NENHUM e SEM INVENTAR. Cada preço/linha de produto = um item. Não agrupe, não resuma, não deduplique. Se a página tem 10 produtos, retorne 10 itens.

Responda SOMENTE em JSON, sem texto extra, no formato:
{"offers": [{"client": string|null, "productName": string, "normalPrice": number|null, "offerPrice": number|null, "department": string|null, "startDate": string|null, "endDate": string|null}]}

- client: nome do cliente/loja da seção onde o produto aparece, EXATAMENTE como escrito (ex.: "F S COMERCIAL", "GRUPO VANGUARDA"). Se o nome não aparecer nesta página, use null (será herdado da seção).
- productName: nome do produto como no encarte (obrigatório).
- offerPrice: preço da OFERTA (o que o cliente paga). normalPrice: preço "de"/antigo/riscado, SÓ quando houver um segundo preço claramente maior. Um único preço → é a OFERTA (offerPrice), normalPrice null. Reais com ponto decimal ("R$ 9,90" → 9.9, "1.234,56" → 1234.56).
- department: departamento/categoria se houver, senão null.
- startDate / endDate: período de validade da oferta em YYYY-MM-DD. Capture SEMPRE que aparecer (ex.: "Ofertas válidas de 06/08 a 16/08" → startDate "2026-08-06", endDate "2026-08-16"). Se o ano não estiver escrito, use o ano de hoje. Hoje é ${today}. Sem validade visível → null.
- Não invente dados: null quando não houver.`;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const cleaned = v.replace(/[^0-9.,]/g, "");
    const normalized = cleaned.includes(",")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// Converte o texto JSON do modelo em ofertas normalizadas.
function parseOffers(text: string | undefined | null): ExtractedOffer[] | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { offers?: unknown };
    if (!Array.isArray(parsed.offers)) return null;
    return parsed.offers
      .map((o): ExtractedOffer | null => {
        const r = o as Record<string, unknown>;
        const productName = toStr(r.productName);
        if (!productName) return null;
        return {
          client: toStr(r.client),
          productName,
          normalPrice: toNumber(r.normalPrice),
          offerPrice: toNumber(r.offerPrice),
          department: toStr(r.department),
          startDate: toStr(r.startDate),
          endDate: toStr(r.endDate),
        };
      })
      .filter((o): o is ExtractedOffer => o !== null);
  } catch (error) {
    console.error("[extract-offers] parse do JSON falhou:", error);
    return null;
  }
}

// ── OpenAI (chat completions com visão / arquivo) ──
async function extractWithOpenAI(
  base64: string,
  mimeType: string,
  prompt: string,
): Promise<ExtractedOffer[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const dataUrl = `data:${mimeType};base64,${base64}`;
  const isPdf = mimeType.includes("pdf");
  const filePart = isPdf
    ? { type: "file", file: { filename: "encarte.pdf", file_data: dataUrl } }
    : { type: "image_url", image_url: { url: dataUrl } };

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        max_tokens: 16_000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, filePart],
          },
        ],
      }),
    });
  } catch (error) {
    console.error("[extract-offers] chamada à OpenAI falhou:", error);
    return null;
  }
  if (!response.ok) {
    console.error("[extract-offers] OpenAI status", response.status);
    return null;
  }
  try {
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return parseOffers(payload.choices?.[0]?.message?.content);
  } catch (error) {
    console.error("[extract-offers] resposta da OpenAI inválida:", error);
    return null;
  }
}

// ── Google Gemini ──
async function extractWithGemini(
  base64: string,
  mimeType: string,
  prompt: string,
): Promise<ExtractedOffer[] | null> {
  const apiKey = geminiApiKey();
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
          maxOutputTokens: 16_384,
        },
      }),
    });
  } catch (error) {
    console.error("[extract-offers] chamada ao Gemini falhou:", error);
    return null;
  }
  if (!response.ok) {
    console.error("[extract-offers] Gemini status", response.status);
    return null;
  }
  try {
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return parseOffers(payload.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error) {
    console.error("[extract-offers] resposta do Gemini inválida:", error);
    return null;
  }
}

// Uma unidade de extração (uma página / uma imagem): Gemini primeiro, OpenAI de
// fallback. Retorna null só quando nenhum provedor respondeu.
async function extractOnce(
  base64: string,
  mimeType: string,
  prompt: string,
): Promise<ExtractedOffer[] | null> {
  if (geminiApiKey()) {
    const viaGemini = await extractWithGemini(base64, mimeType, prompt);
    if (viaGemini) return viaGemini;
  }
  return extractWithOpenAI(base64, mimeType, prompt);
}

// Quebra o PDF em base64 de uma página cada (sem renderizar — só copia páginas).
async function splitPdfPages(base64: string): Promise<string[] | null> {
  try {
    const src = await PDFDocument.load(Buffer.from(base64, "base64"));
    const total = src.getPageCount();
    if (total <= 1) return null; // 1 página → passe único, sem overhead
    const pages: string[] = [];
    for (let i = 0; i < total; i++) {
      const doc = await PDFDocument.create();
      const [page] = await doc.copyPages(src, [i]);
      doc.addPage(page);
      const bytes = await doc.save();
      pages.push(Buffer.from(bytes).toString("base64"));
    }
    return pages;
  } catch (error) {
    console.error("[extract-offers] split do PDF falhou:", error);
    return null;
  }
}

// Roda `fn` sobre os itens com concorrência limitada, preservando a ordem.
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

// Propaga cliente e validade do cabeçalho da seção para os itens seguintes (na
// ordem de leitura). Ao trocar de cliente, zera a validade para não vazar o
// período de uma loja para outra.
export function fillForward(offers: ExtractedOffer[]): ExtractedOffer[] {
  let curClient: string | null = null;
  let curStart: string | null = null;
  let curEnd: string | null = null;
  return offers.map((o) => {
    const client = o.client ?? curClient;
    if (client !== curClient) {
      curClient = client;
      curStart = null;
      curEnd = null;
    }
    const startDate = o.startDate ?? curStart;
    const endDate = o.endDate ?? curEnd;
    curStart = startDate;
    curEnd = endDate;
    return { ...o, client, startDate, endDate };
  });
}

// Extrai ofertas de um encarte (imagem ou PDF). PDFs multipágina são extraídos
// página a página e concatenados na ordem; imagem/PDF de 1 página = passe único.
export async function extractOffersFromImage(
  base64: string,
  mimeType: string,
): Promise<ExtractedOffer[] | null> {
  const today = new Date().toISOString().slice(0, 10);
  const prompt = buildPrompt(today);

  if (mimeType.includes("pdf")) {
    // 1º: tenta ler a TABELA pela camada de texto (exato, sem IA). Só cai na
    // visão se o PDF não for uma tabela legível (encarte gráfico / escaneado).
    try {
      const { parsePdfTable } = await import("./parse-pdf-table");
      const viaText = await parsePdfTable(base64);
      if (viaText && viaText.length > 0) return viaText;
    } catch (error) {
      console.error("[extract-offers] parse de texto falhou:", error);
    }
    const pages = await splitPdfPages(base64);
    if (pages && pages.length > 0) {
      const perPage = await mapLimit(pages, PAGE_CONCURRENCY, (p) =>
        extractOnce(p, "application/pdf", prompt),
      );
      // Nenhuma página respondeu (todas null) → falha real.
      if (perPage.every((r) => r === null)) return null;
      const merged = perPage.flatMap((r) => r ?? []);
      return fillForward(merged);
    }
  }

  const single = await extractOnce(base64, mimeType, prompt);
  return single === null ? null : fillForward(single);
}
