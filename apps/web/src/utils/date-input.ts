// Ponte entre `<input type="date">` ("YYYY-MM-DD") e o instante que o servidor
// guarda. As conversões são em HORÁRIO LOCAL de propósito: "vale até dia 30"
// significa até o fim do dia 30 na loja — converter por UTC encerraria a
// promoção às 21h do dia 29 em Fortaleza.

/** Início do dia informado, em ISO. String vazia → `null` (vale desde já). */
export function toIsoStart(value: string): string | null {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

/** Fim do dia informado, em ISO — o dia escolhido conta inteiro. */
export function toIsoEnd(value: string): string {
  return new Date(`${value}T23:59:59`).toISOString();
}

/** ISO → "YYYY-MM-DD" local, para preencher o input de volta. */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
