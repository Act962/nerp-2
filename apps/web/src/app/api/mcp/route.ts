import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { autenticarAgente } from "@/features/mcp/server/autenticar";
import { criarServidorMcp } from "@/features/mcp/server/servidor";

// MCP do NERP por HTTP (Streamable HTTP, sem sessão): cada requisição monta o
// servidor com as habilidades do token e responde em JSON. Sem sessão porque o
// app roda em mais de uma instância — não há onde guardar estado entre chamadas,
// e nenhuma ferramenta precisa dele.
//
// Autenticação: `Authorization: Bearer <token>`, gerado na tela do mapeamento
// (Agente de IA). Ver `features/mcp/server/autenticar.ts`.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Leitura do schema inteiro no ERP do cliente pode levar dezenas de segundos.
export const maxDuration = 120;

async function tratar(request: Request): Promise<Response> {
  const autenticacao = await autenticarAgente(request);
  if (!autenticacao.ok) {
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32001, message: autenticacao.motivo },
        id: null,
      },
      {
        status: autenticacao.status,
        headers: { "WWW-Authenticate": 'Bearer realm="nerp-mcp"' },
      },
    );
  }

  const servidor = criarServidorMcp(autenticacao.agente);
  const transporte = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await servidor.connect(transporte);
  try {
    return await transporte.handleRequest(request);
  } finally {
    // Sem sessão, nada sobrevive à requisição: fechar libera o servidor.
    void servidor.close().catch(() => {});
  }
}

export { tratar as DELETE, tratar as GET, tratar as POST };
