import "server-only";

// Foto REAL do produto pelo código de barras (GTIN/EAN) via Cosmos (Bluesoft).
// Usa o COSMOS_API_TOKEN que já existe no ambiente — zero setup extra. Só acha
// produtos com barcode cadastrado e que existam na base. Best-effort: nunca
// lança; devolve null em qualquer falha.

const ENDPOINT = "https://api.cosmos.bluesoft.com.br/gtins";

export function isCosmosConfigured(): boolean {
  return Boolean(process.env.COSMOS_API_TOKEN);
}

export async function fetchCosmosImage(
  barcode: string | null | undefined,
): Promise<string | null> {
  const token = process.env.COSMOS_API_TOKEN;
  const gtin = (barcode ?? "").replace(/\D/g, "");
  if (!token || !gtin) return null;

  try {
    const res = await fetch(`${ENDPOINT}/${gtin}`, {
      headers: {
        "X-Cosmos-Token": token,
        "Content-Type": "application/json",
        "User-Agent": "nerp/1.0",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail?: string | null };
    const thumb = data.thumbnail?.trim();
    return thumb ? thumb : null;
  } catch {
    return null;
  }
}
