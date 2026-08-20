import "server-only";

// Busca imagens REAIS de produtos na web via Google Custom Search JSON API
// (searchType=image) — devolve as mesmas imagens do Google Imagens. Retorna só
// as URLs diretas; o download/validação definitivos ficam no "usar imagem".
//
// Config (ambiente):
//  - GOOGLE_CSE_ID: id do mecanismo (Programmable Search Engine, com busca de
//    imagem + "toda a web" ligados). Obrigatório. (público, não é segredo)
//  - GOOGLE_CSE_API_KEY: API key do Google Cloud com a Custom Search API
//    habilitada. Se ausente, usa GOOGLE_GENERATIVE_AI_API_KEY (a mesma chave
//    Google serve, desde que a Custom Search API esteja habilitada no projeto).
//
// Best-effort: nunca lança — devolve [] em qualquer falha/config faltando.

const ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const MAX_URLS = 12;

type CseResponse = {
  items?: { link?: string }[];
};

function cseKey(): string | undefined {
  return (
    process.env.GOOGLE_CSE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
  );
}

export function isImageSearchConfigured(): boolean {
  return Boolean(cseKey() && process.env.GOOGLE_CSE_ID);
}

export async function searchWebProductImages(query: string): Promise<string[]> {
  const q = query.trim();
  const key = cseKey();
  const cx = process.env.GOOGLE_CSE_ID;
  if (!q || !key || !cx) return [];

  const url =
    `${ENDPOINT}?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}` +
    `&searchType=image&num=10&safe=active&q=${encodeURIComponent(q)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as CseResponse;
    const links = (data.items ?? [])
      .map((item) => item.link)
      .filter((link): link is string => Boolean(link));
    return [...new Set(links)].slice(0, MAX_URLS);
  } catch {
    return [];
  }
}
