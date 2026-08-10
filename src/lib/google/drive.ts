import "server-only";

// Cliente HTTP direto para Google Drive API v3 + OAuth 2.0. Optamos por não
// adicionar `googleapis` (SDK oficial) — o uso é focado (list de pasta +
// download por fileId) e o SDK carrega ~15MB de deps. Fetch + JSON resolve.
//
// Endpoints usados:
//   OAuth  → https://accounts.google.com/o/oauth2/v2/auth  (authorize)
//   Token  → https://oauth2.googleapis.com/token           (troca/refresh)
//   UserInfo → https://openidconnect.googleapis.com/v1/userinfo (email)
//   List   → https://www.googleapis.com/drive/v3/files
//   Get    → https://www.googleapis.com/drive/v3/files/{id}?alt=media

// Scopes:
//  - openid + email → só pra pegar o e-mail da conta conectada
//  - drive.readonly → ler arquivos do Drive (não modifica nada do usuário)
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Config Google ausente. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env.local.",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

// URL pra iniciar o consentimento. `state` é opaco — usamos pra amarrar o
// callback à sessão do usuário (evita CSRF e sabe quem está conectando).
export function buildAuthorizeUrl(state: string): string {
  const cfg = getConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: "offline", // pedimos refresh_token
    prompt: "consent", // força re-consentimento — Google só devolve refresh_token na 1ª vez
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // segundos
  scope: string;
  id_token?: string;
  token_type: "Bearer";
}

// Troca o `code` do callback pelos tokens iniciais.
export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const cfg = getConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange falhou (${res.status}): ${body}`);
  }
  return res.json();
}

// Renova o accessToken usando o refreshToken (persistido cifrado no banco).
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
}> {
  const cfg = getConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google refresh falhou (${res.status}): ${body}`);
  }
  return res.json();
}

// Pega o e-mail da conta conectada — só pra exibir na UI ("Conectado como X").
export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<{ email: string; sub: string }> {
  const res = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`userinfo falhou (${res.status})`);
  return res.json();
}

// Lista pastas + arquivos filhos de um `parentId` (ou raiz se `null`). Retorna
// só imagens quando `onlyImages` — o assistente de import só precisa disso.
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  isFolder: boolean;
  isImage: boolean;
}

export async function listDriveChildren(
  accessToken: string,
  {
    parentId,
    onlyImages,
    pageSize = 200,
    pageToken,
  }: {
    parentId?: string | null;
    onlyImages?: boolean;
    pageSize?: number;
    pageToken?: string;
  },
): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const conditions = ["trashed = false"];
  if (parentId) conditions.push(`'${parentId}' in parents`);
  else conditions.push(`'root' in parents`);
  if (onlyImages)
    conditions.push(
      `(mimeType contains 'image/' or mimeType = 'application/vnd.google-apps.folder')`,
    );

  const q = conditions.join(" and ");
  const params = new URLSearchParams({
    q,
    pageSize: String(pageSize),
    fields:
      "nextPageToken, files(id, name, mimeType, size, parents)",
    orderBy: "folder,name",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`drive.files.list falhou (${res.status}): ${body}`);
  }
  const data = (await res.json()) as {
    files: {
      id: string;
      name: string;
      mimeType: string;
      size?: string;
      parents?: string[];
    }[];
    nextPageToken?: string;
  };
  const files = data.files.map((file) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    parents: file.parents,
    isFolder: file.mimeType === "application/vnd.google-apps.folder",
    isImage: file.mimeType.startsWith("image/"),
  }));
  return { files, nextPageToken: data.nextPageToken };
}

// Baixa o conteúdo binário de um arquivo do Drive. Devolve o Blob pra o caller
// decidir o que fazer (upload pro R2, hash, whatever).
export async function downloadDriveFile(
  accessToken: string,
  fileId: string,
): Promise<{ blob: Blob; contentType: string; size: number }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`drive.files.get falhou (${res.status}): ${body}`);
  }
  const blob = await res.blob();
  return {
    blob,
    contentType: res.headers.get("Content-Type") ?? "application/octet-stream",
    size: blob.size,
  };
}
