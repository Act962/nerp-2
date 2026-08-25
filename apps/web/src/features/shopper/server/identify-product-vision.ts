import "server-only";

// Identificação de produto por foto usando Google Gemini Flash — a opção de
// visão mais barata (free tier + custo baixo por token). REST puro (fetch
// nativo), sem dependência. Sem GEMINI_API_KEY → retorna null e o app cai no
// fallback "escaneie o código de barras". Trocar de provedor = trocar só este
// arquivo.

const MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-2.0-flash";

export interface VisionGuess {
  brand: string | null;
  name: string | null;
  // Termos do mais específico ao mais genérico, p/ casar com o catálogo.
  searchTerms: string[];
  confident: boolean;
}

const PROMPT = `Você vê a foto de UM produto de supermercado. Identifique-o.
Responda SOMENTE em JSON, sem texto extra, no formato:
{"brand": string|null, "name": string|null, "searchTerms": string[], "confident": boolean}
- name: nome completo provável em português (marca + produto + tamanho).
- searchTerms: 2 a 4 termos de busca do MAIS específico ao MAIS genérico. Ex.: ["Coca-Cola Lata 350ml","Coca-Cola Lata","Coca-Cola"].
- confident: false se a imagem estiver ruim ou você não tiver certeza de que é um produto identificável.`;

export async function identifyProductFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<VisionGuess | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
          maxOutputTokens: 256,
        },
      }),
    });
  } catch (error) {
    console.error("[vision] chamada ao Gemini falhou:", error);
    return null;
  }

  if (!response.ok) {
    console.error("[vision] Gemini status", response.status);
    return null;
  }

  try {
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as Partial<VisionGuess>;
    return {
      brand: parsed.brand ?? null,
      name: parsed.name ?? null,
      searchTerms: Array.isArray(parsed.searchTerms)
        ? parsed.searchTerms
            .filter((term) => typeof term === "string")
            .slice(0, 4)
        : [],
      confident: parsed.confident === true,
    };
  } catch (error) {
    console.error("[vision] parse da resposta falhou:", error);
    return null;
  }
}
