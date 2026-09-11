import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { semAprovacoesPendentes } from "./orchestrator";

/**
 * O caso que matou uma conversa de verdade: a pessoa digitou em vez de
 * responder no cartão, e a chamada de ferramenta foi para a OpenAI sem saída.
 * A API recusa a requisição inteira ("No tool output found for function
 * call"), e como o histórico fica guardado no navegador, toda tentativa
 * seguinte levava a mesma chamada pendurada junto.
 */

function parteDeTool(state: string, extra: Record<string, unknown> = {}) {
  return {
    type: "tool-criarCatalogoPromocional",
    toolCallId: "call_abc",
    state,
    input: { nome: "Ofertas" },
    ...extra,
  };
}

function historico(...partesDoAssistente: unknown[]): UIMessage[] {
  return [
    {
      id: "1",
      role: "user",
      parts: [{ type: "text", text: "cria um catálogo" }],
    },
    { id: "2", role: "assistant", parts: partesDoAssistente },
  ] as unknown as UIMessage[];
}

describe("semAprovacoesPendentes", () => {
  it("tira a chamada que ficou esperando um sim que nunca veio", () => {
    const limpo = semAprovacoesPendentes(
      historico(parteDeTool("approval-requested", { approval: { id: "a1" } })),
    );
    expect(limpo[1].parts).toHaveLength(0);
  });

  it("mantém a que a pessoa aprovou — essa o SDK sabe resolver", () => {
    const limpo = semAprovacoesPendentes(
      historico(
        parteDeTool("approval-responded", {
          approval: { id: "a1", approved: true },
        }),
      ),
    );
    expect(limpo[1].parts).toHaveLength(1);
  });

  it("mantém a recusada, que também tem desfecho", () => {
    const limpo = semAprovacoesPendentes(
      historico(parteDeTool("output-denied", { approval: { id: "a1" } })),
    );
    expect(limpo[1].parts).toHaveLength(1);
  });

  it("mantém a que já executou e tem resultado", () => {
    const limpo = semAprovacoesPendentes(
      historico(parteDeTool("output-available", { output: { id: "cat_1" } })),
    );
    expect(limpo[1].parts).toHaveLength(1);
  });

  it("preserva o texto ao lado da chamada pendurada", () => {
    const limpo = semAprovacoesPendentes(
      historico(
        { type: "text", text: "Posso montar assim:" },
        parteDeTool("approval-requested", { approval: { id: "a1" } }),
      ),
    );
    expect(limpo[1].parts).toHaveLength(1);
    expect((limpo[1].parts[0] as { type: string }).type).toBe("text");
  });

  it("não mexe no que a pessoa escreveu", () => {
    const original = historico(
      parteDeTool("approval-requested", { approval: { id: "a1" } }),
    );
    const limpo = semAprovacoesPendentes(original);
    expect(limpo[0]).toBe(original[0]);
  });

  it("devolve a mesma mensagem quando não há nada a tirar", () => {
    const original = historico({ type: "text", text: "Pronto." });
    const limpo = semAprovacoesPendentes(original);
    expect(limpo[1]).toBe(original[1]);
  });
});
