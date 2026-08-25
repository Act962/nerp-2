/**
 * Envia um arquivo para o R2 usando o fluxo de URL presignada (`/api/s3/upload`)
 * e retorna a chave do objeto. Uso client-side.
 *
 * As falhas mais comuns em campo são de REDE (sinal ruim dentro da loja) na hora
 * do envio direto ao R2. Por isso: (1) retry com espera nas falhas transitórias
 * e (2) erros com a ETAPA + status HTTP, pra a tela mostrar exatamente onde foi.
 */

/** Falha do upload com a etapa e o status, pra facilitar a identificação. */
export class UploadError extends Error {
  constructor(
    message: string,
    readonly step: "preparar" | "enviar",
    readonly status?: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Só vale a pena tentar de novo em falha de rede, 5xx ou 429 (throttle). */
function isRetryable(status?: number) {
  return status === undefined || status >= 500 || status === 429;
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  attempts = 3,
): Promise<Response> {
  let lastStatus: number | undefined;
  let lastNetworkError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(input, init);
      if (res.ok) return res;
      lastStatus = res.status;
      // Erro do cliente (4xx, exceto 429): não adianta repetir.
      if (!isRetryable(res.status)) return res;
    } catch (error) {
      // Rejeição de fetch = falha de rede (offline, CORS, conexão caiu).
      lastNetworkError = error;
      lastStatus = undefined;
    }
    if (i < attempts - 1) await sleep(600 * (i + 1));
  }
  if (lastNetworkError) throw lastNetworkError;
  // Devolve a última resposta não-ok pra o chamador montar o erro com o status.
  return await fetch(input, init).catch(() => {
    throw new Error(`HTTP ${lastStatus ?? "?"}`);
  });
}

export async function uploadToR2(file: File, isImage = true): Promise<string> {
  // Etapa 1 — pedir a URL presignada ao próprio servidor (mesma origem).
  let presigned: Response;
  try {
    presigned = await fetchWithRetry("/api/s3/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        isImage,
      }),
    });
  } catch (error) {
    throw new UploadError(
      `Não foi possível falar com o servidor para preparar o envio (${
        error instanceof Error ? error.message : "sem conexão"
      }).`,
      "preparar",
    );
  }
  if (!presigned.ok) {
    const body = await presigned.text().catch(() => "");
    throw new UploadError(
      `O servidor recusou preparar o envio (HTTP ${presigned.status}).${
        body ? ` ${body.slice(0, 200)}` : ""
      }`,
      "preparar",
      presigned.status,
    );
  }
  const { presignedUrl, key } = await presigned.json();

  // Etapa 2 — enviar o arquivo direto ao R2. É aqui que a rede da loja derruba.
  let put: Response;
  try {
    put = await fetchWithRetry(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch (error) {
    throw new UploadError(
      `A conexão caiu ao enviar a foto (${
        error instanceof Error ? error.message : "sem conexão"
      }). Verifique a internet e tente salvar de novo.`,
      "enviar",
    );
  }
  if (!put.ok) {
    throw new UploadError(
      `O envio da foto foi recusado (HTTP ${put.status}).`,
      "enviar",
      put.status,
    );
  }

  return key;
}
