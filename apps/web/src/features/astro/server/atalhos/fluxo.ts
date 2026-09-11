import "server-only";

import { createUIMessageStream } from "ai";

/**
 * A resposta do atalho, no formato que o painel já sabe desenhar.
 *
 * Ela entra na conversa como QUALQUER outra resposta: o cliente a guarda, e na
 * mensagem seguinte ela volta no histórico — então o modelo enxerga o que foi
 * respondido aqui e não recomeça do zero. O atalho pula o modelo, não a
 * memória da conversa.
 *
 * O `start` com `messageId` não é enfeite: sem ele a mensagem sai sem id, e o
 * painel desenha a lista por id — duas respostas de atalho colidiriam.
 */
export function fluxoDoAtalho(texto: string) {
  return createUIMessageStream({
    execute: ({ writer }) => {
      const id = "t";
      writer.write({
        type: "start",
        messageId: `atalho-${crypto.randomUUID()}`,
      });
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: texto });
      writer.write({ type: "text-end", id });
      writer.write({ type: "finish" });
    },
  });
}
