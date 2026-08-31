import "server-only";
import { request } from "node:https";

/**
 * Material de TLS mútuo. Os dois formatos existem no mercado brasileiro: o
 * Inter entrega `.crt` + `.key` em PEM, o Sicoob entrega `.pfx` ICP-Brasil com
 * senha.
 */
export type MtlsMaterial =
  | { cert: string; key: string }
  | { pfx: Buffer; passphrase: string };

export type MtlsRequest = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  material: MtlsMaterial;
  timeoutMs?: number;
};

export type MtlsResponse = { status: number; body: string };

const TIMEOUT_PADRAO_MS = 20_000;

/**
 * Requisição HTTPS com TLS mútuo.
 *
 * Usa `node:https` e não `fetch` porque o fetch global só aceita certificado de
 * cliente através de um dispatcher do undici, que não é dependência deste
 * projeto. Consequência que vale repetir: **toda rota que chamar isto precisa
 * rodar no runtime Node** — Edge não faz TLS mútuo.
 *
 * Erro de rede vira `Error` com mensagem curta e sem material de credencial: o
 * texto sobe para a tela e é gravado em `lastSyncError`.
 */
export function mtlsRequest({
  url,
  method = "GET",
  headers = {},
  body,
  material,
  timeoutMs = TIMEOUT_PADRAO_MS,
}: MtlsRequest): Promise<MtlsResponse> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        headers: body
          ? { ...headers, "content-length": Buffer.byteLength(body).toString() }
          : headers,
        ...material,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(
        new Error(
          `Tempo esgotado ao falar com o provedor (${timeoutMs / 1000}s).`,
        ),
      );
    });

    // Erro de TLS aqui é quase sempre certificado errado, vencido ou trocado —
    // a causa nº 1 de integração bancária quebrada.
    req.on("error", (error) => {
      reject(new Error(traduzErroDeRede(error)));
    });

    if (body) req.write(body);
    req.end();
  });
}

function traduzErroDeRede(error: Error): string {
  const codigo = (error as NodeJS.ErrnoException).code;
  switch (codigo) {
    case "CERT_HAS_EXPIRED":
      return "O certificado enviado está vencido. Emita um novo no portal do provedor.";
    case "ERR_TLS_CERT_ALTNAME_INVALID":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
      return "O provedor recusou o certificado. Confira se o arquivo é o da integração e se a chave privada é o par dele.";
    case "ENOTFOUND":
    case "ECONNREFUSED":
      return "Não foi possível alcançar o provedor. Confira a conexão e tente de novo.";
    default:
      return `Falha de comunicação com o provedor${codigo ? ` (${codigo})` : ""}.`;
  }
}
