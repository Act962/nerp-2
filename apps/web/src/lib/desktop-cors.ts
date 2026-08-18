/**
 * CORS para o app desktop (cross-origin) bater em `/api/rpc`.
 *
 * Só ecoa origins que estejam na allowlist `DESKTOP_ALLOWED_ORIGINS` (CSV). O
 * web é same-origin: não manda `Origin` cross-site, então recebe `{}` e nada
 * muda para ele. `Allow-Credentials: false` é proposital — device usa bearer,
 * não cookie; liberar credenciais cross-origin exporia a sessão do web.
 */
function allowedOrigins(): string[] {
  return (process.env.DESKTOP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function desktopCorsHeaders(
  origin: string | null,
): Record<string, string> {
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, GET, HEAD, OPTIONS",
    "Access-Control-Allow-Credentials": "false",
    Vary: "Origin",
  };
}
