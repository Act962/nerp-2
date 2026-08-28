/**
 * CORS para o app desktop (cross-origin) bater em `/api/rpc`.
 *
 * Só ecoa origins que estejam na allowlist `DESKTOP_ALLOWED_ORIGINS` (CSV). O
 * web é same-origin: não manda `Origin` cross-site, então recebe `{}` e nada
 * muda para ele. `Allow-Credentials: false` é proposital — device usa bearer,
 * não cookie; liberar credenciais cross-origin exporia a sessão do web.
 */

/**
 * Origens fixas da webview do Tauri v2. O app INSTALADO sempre manda uma
 * destas, e o valor não depende de nenhum deploy — então ficam embutidas em vez
 * de esperar que quem configura o ambiente lembre delas. Esquecer
 * `http://tauri.localhost` no `DESKTOP_ALLOWED_ORIGINS` de produção quebra o
 * pareamento do terminal sem sintoma nenhum além de um erro de CORS no console
 * do device (bug já reproduzido em dev).
 *
 * Não afrouxa segurança: aqui o CORS não é a fronteira — a fronteira é o bearer
 * por device (`verifyDeviceAuth`), e `Allow-Credentials` continua `false`, então
 * nenhuma sessão de browser trafega por estas origens.
 */
const TAURI_ORIGINS = [
  "http://tauri.localhost",
  "https://tauri.localhost",
  "tauri://localhost",
];

function allowedOrigins(): string[] {
  const configured = (process.env.DESKTOP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...TAURI_ORIGINS, ...configured];
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
