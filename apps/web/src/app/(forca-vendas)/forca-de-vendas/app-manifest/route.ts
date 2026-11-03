/**
 * Ficha de app (Web App Manifest) do módulo: no "Adicionar à tela inicial" o
 * celular ganha o atalho "Força de Vendas", que abre direto na home do
 * módulo, em tela cheia. O escopo fica preso a `/forca-de-vendas` para o
 * atalho não engolir o resto do ERP. Sem extensão no caminho pelo mesmo motivo
 * do manifest da vitrine: o middleware não trata arquivo com extensão.
 */
export function GET() {
  const manifest = {
    name: "Força de Vendas ÓRBITA",
    short_name: "Força de Vendas",
    description: "Carteira, pedidos, rota e mensagens do consultor externo.",
    id: "/forca-de-vendas",
    start_url: "/forca-de-vendas",
    scope: "/forca-de-vendas",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    theme_color: "#1d4ed8",
    background_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
