import "server-only";

import type { ToolSet } from "ai";
import type { ContextoToolsApp } from "./_contexto";

/**
 * Busca na web e leitura de página.
 *
 * As duas são executadas pelo PROVEDOR, não por este servidor: o Google roda a
 * busca dentro da própria chamada e devolve o texto já com as fontes. Por isso
 * não há `execute` aqui, e por isso os nomes são obrigatoriamente
 * `google_search` e `url_context` — é assim que o provedor as reconhece;
 * renomeadas, viram tools comuns que ninguém executa.
 *
 * Só entram quando quem atende é o Google. Com a OpenAI, o conjunto sai vazio.
 */
export function construirToolsDeBuscaWeb(ctx: ContextoToolsApp): ToolSet {
  const google = ctx.modelo?.google;
  if (!google) return {};

  return {
    google_search: google.tools.googleSearch({}),
    url_context: google.tools.urlContext({}),
  };
}
