import "server-only";

// Ping do provedor Focus NFe (https://focusnfe.com.br), usado pelo "Testar
// provedor" do painel. A emissão mora em `features/fiscal/server/infra/focus`.

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

// Referência que nunca existe: consultá-la é um GET sem efeito em que só a
// autenticação muda a resposta.
const REF_PING = "nerp-ping-token";

/**
 * Valida o token da EMPRESA (o que emite) consultando uma NFC-e inexistente.
 *
 * Não usa `/v2/empresas`: esse endpoint é da conta de revenda e responde 404
 * para o token de uma empresa mesmo quando ele está certo — era um falso
 * negativo. Na consulta de nota, token bom devolve 404 `nao_encontrado` e
 * token ruim devolve 401 `permissao_negada`.
 */
export async function pingFocus(
  environment: FocusEnvironment,
  token: string,
  opcoes: { fetch?: typeof fetch } = {},
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

  const doFetch = opcoes.fetch ?? fetch;
  const url = `${focusBaseUrl(environment)}/v2/nfce/${REF_PING}`;
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await doFetch(url, {
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

    if (res.status === 404) {
      const corpo = (await res.json().catch(() => null)) as {
        codigo?: string;
      } | null;
      if (corpo?.codigo === "nao_encontrado")
        return { ok: true, status: res.status, latencyMs };
    }
    return {
      ok: false,
      status: res.status,
      latencyMs,
      message:
        res.status === 401 || res.status === 403
          ? "Token inválido para este ambiente (confira se é o de homologação ou o de produção)"
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
