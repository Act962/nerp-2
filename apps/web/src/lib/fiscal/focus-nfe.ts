import "server-only";

// Cliente do provedor Focus NFe (https://focusnfe.com.br). Nesta Fase A só
// implementa `ping()` — valida o token chamando um endpoint leve. Emissão de
// NFCe entra na Fase B (POST /v2/nfce, polling do status, XML/PDF de retorno).

const BASE_URLS = {
  HOMOLOGACAO: "https://homologacao.focusnfe.com.br",
  PRODUCAO: "https://api.focusnfe.com.br",
} as const;

export type FocusEnvironment = keyof typeof BASE_URLS;

export function focusBaseUrl(environment: FocusEnvironment): string {
  return BASE_URLS[environment];
}

// Auth é HTTP Basic com o TOKEN como usuário e senha vazia.
function authHeader(token: string): string {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

// Valida a credencial pedindo os dados da empresa do usuário. Se o token não
// serve, a API retorna 401/403. Não é intrusivo (só GET).
export async function pingFocus(
  environment: FocusEnvironment,
  token: string,
  empresaId?: string | null,
): Promise<{
  ok: boolean;
  status: number;
  latencyMs: number;
  message?: string;
}> {
  if (!token)
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      message: "Token não configurado para este ambiente",
    };

  // Endpoint padrão de leitura: /v2/empresas (lista as empresas do usuário).
  // Se `empresaId` foi informado, especifica pra retornar menos dados.
  const url = empresaId
    ? `${focusBaseUrl(environment)}/v2/empresas/${encodeURIComponent(empresaId)}`
    : `${focusBaseUrl(environment)}/v2/empresas`;

  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authHeader(token),
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - started;
    if (res.ok) return { ok: true, status: res.status, latencyMs };
    // 401 = token inválido; 403 = token não tem acesso à empresa;
    // 404 = empresaId errado; 5xx = provedor com problema.
    return {
      ok: false,
      status: res.status,
      latencyMs,
      message:
        res.status === 401 || res.status === 403
          ? "Token inválido ou sem permissão"
          : res.status === 404
            ? "Empresa não encontrada no provedor (verifique o ID)"
            : `Provedor respondeu ${res.status}`,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      message: "Sem resposta do provedor (timeout ou falha de rede)",
    };
  }
}
