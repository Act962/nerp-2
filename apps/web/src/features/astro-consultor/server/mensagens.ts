/** O texto de uma `UIMessage`, para medir o que a pessoa mandou. */
export function textoDaMensagem(mensagem: unknown): string {
  if (typeof mensagem !== "object" || mensagem === null) return "";
  const partes = (mensagem as { parts?: unknown }).parts;
  if (!Array.isArray(partes)) return "";
  return partes
    .map((parte) =>
      typeof parte === "object" &&
      parte !== null &&
      (parte as { type?: unknown }).type === "text"
        ? String((parte as { text?: unknown }).text ?? "")
        : "",
    )
    .join(" ");
}

/** Tamanho máximo de uma mensagem enviada ao Astro, nos dois canais. */
export const LIMITE_TEXTO = 2000;
