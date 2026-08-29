import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// Identidade do build que este servidor está servindo.
//
// Existe para a aba aberta descobrir que saiu deploy ANTES de pedir um chunk
// que não existe mais. O deploy do Coolify troca o container inteiro: build id
// novo, hashes novos, arquivos antigos apagados — e quem estava com o PDV
// aberto quebra na próxima requisição preguiçosa.
//
// FALHA SEGURA: se o BUILD_ID não puder ser lido, devolve uma constante. Um
// valor que variasse a cada chamada faria o cliente recarregar em laço.
const FALLBACK = "desconhecido";

let cached: string | null = null;

async function buildId(): Promise<string> {
  if (cached) return cached;
  try {
    const file = path.join(process.cwd(), ".next", "BUILD_ID");
    const id = (await readFile(file, "utf8")).trim();
    cached = id || FALLBACK;
  } catch {
    // Em `next dev` o arquivo pode não existir; não é erro que mereça log.
    cached = FALLBACK;
  }
  return cached;
}

// Sem cache: é justamente a mudança deste valor que queremos enxergar.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { buildId: await buildId() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
