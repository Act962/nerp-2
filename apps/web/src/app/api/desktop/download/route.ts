import { getLatestDesktopRelease } from "@/lib/desktop-release";
import { NextResponse } from "next/server";

/**
 * Link estável para o instalador mais recente: `/api/desktop/download?os=windows`.
 *
 * Redireciona para a URL versionada no bucket. Existe para que um link mandado
 * ao cliente (WhatsApp, e-mail, chamado) continue valendo depois de publicar
 * uma versão nova — a página de Aplicativos usa o mesmo caminho.
 *
 * Aberto de propósito: o objeto no bucket já é público, e o instalador sozinho
 * não dá acesso a nada — o app só funciona depois de parear com credenciais.
 */
export async function GET(request: Request) {
  const os = new URL(request.url).searchParams.get("os") ?? "windows";

  const result = await getLatestDesktopRelease();
  if (result.status !== "ok") {
    return NextResponse.json(
      { error: "Nenhuma versão publicada no momento." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const download = result.release.downloads.find((item) => item.os === os);
  if (!download) {
    return NextResponse.json(
      { error: `Sem instalador publicado para "${os}".` },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  // 302 (não 301): a URL de destino muda a cada release; um permanente ficaria
  // grudado no cache do navegador do cliente apontando para a versão velha.
  return NextResponse.redirect(download.url, {
    status: 302,
    headers: { "cache-control": "no-store" },
  });
}
