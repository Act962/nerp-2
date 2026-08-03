/**
 * WhatsApp brasileiro. Usado no cliente (máscara do campo) e no servidor
 * (validação antes de gravar), então nada de `server-only` aqui.
 *
 * Guardamos sempre em E.164 (+55DDDNNNNNNNNN) porque é o formato que abre um
 * `wa.me/` sem tratamento e não depende de como o promotor digitou.
 */

/** Só os dígitos, já sem o 55 do país. */
function nationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // "+55 11 9…", "5511 9…" — tira o país. O corte só vale para 12/13 dígitos:
  // um fixo de SP começa com 55 no meio do número (ex.: 11 5555-1234) e não
  // pode perder os dois primeiros.
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return digits;
}

/**
 * Valida e normaliza. Retorna `null` se não for um celular BR plausível.
 *
 * Exige 11 dígitos com o nono dígito começando em 9: WhatsApp não existe em
 * fixo, então aceitar 10 dígitos só geraria cadastro que ninguém consegue
 * contatar — justo o que esta obrigatoriedade quer evitar.
 */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = nationalDigits(raw);
  if (digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (digits[2] !== "9") return null;
  return `+55${digits}`;
}

/** Exibição: "(11) 99999-9999". Devolve a entrada crua se não reconhecer. */
export function formatWhatsapp(value: string): string {
  const digits = nationalDigits(value);
  if (digits.length !== 11) return value;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Máscara progressiva enquanto digita. */
export function maskWhatsapp(raw: string): string {
  const digits = nationalDigits(raw).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
