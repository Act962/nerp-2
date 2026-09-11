import { readUIMessageStream, type UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { fluxoDoAtalho } from "./fluxo";

/**
 * O que se garante aqui: o atalho pula o MODELO, não a memória da conversa.
 *
 * A resposta precisa virar uma mensagem de assistente de verdade — com id,
 * papel e parte de texto —, porque é assim que o painel a guarda e a manda de
 * volta no histórico da mensagem seguinte. Sem isso, o Astro recomeçaria do
 * zero a cada pergunta respondida por atalho.
 */

async function lerUltima(texto: string): Promise<UIMessage | null> {
  let ultima: UIMessage | null = null;
  for await (const mensagem of readUIMessageStream({
    stream: fluxoDoAtalho(texto),
  })) {
    ultima = mensagem;
  }
  return ultima;
}

describe("fluxoDoAtalho", () => {
  it("vira mensagem de assistente com o texto completo", async () => {
    const mensagem = await lerUltima("Você tem 82 produtos.");
    expect(mensagem?.role).toBe("assistant");
    expect(mensagem?.parts).toEqual([
      { type: "text", text: "Você tem 82 produtos.", state: "done" },
    ]);
  });

  it("sai com id — o painel desenha a lista por id", async () => {
    const mensagem = await lerUltima("Você tem 82 produtos.");
    expect(mensagem?.id).toBeTruthy();
    expect(mensagem?.id.startsWith("atalho-")).toBe(true);
  });

  it("duas respostas não colidem", async () => {
    const [a, b] = await Promise.all([
      lerUltima("primeira"),
      lerUltima("segunda"),
    ]);
    expect(a?.id).not.toBe(b?.id);
  });

  it("aguenta texto com acento e quebra de linha", async () => {
    const mensagem = await lerUltima("Ontem você vendeu R$ 1.234,00.\nOK.");
    expect((mensagem?.parts[0] as { text: string }).text).toContain("R$");
  });
});
