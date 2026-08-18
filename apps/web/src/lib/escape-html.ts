/**
 * Escapa texto para dentro de HTML montado à mão.
 *
 * Existe porque o popup do Leaflet aceita HTML e os nomes vêm do cadastro do
 * usuário e do OpenStreetMap — nenhum dos dois é campo controlado. Escapa `"`
 * também, que é o que um atributo entre aspas duplas precisa.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) =>
    char === "&"
      ? "&amp;"
      : char === "<"
        ? "&lt;"
        : char === ">"
          ? "&gt;"
          : "&quot;",
  );
}
