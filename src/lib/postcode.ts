/**
 * CEP reduzido a oito dígitos.
 *
 * Mesma regra do documento: só dígitos no banco, máscara só na renderização.
 * Comprimento diferente de 8 é digitação incompleta — guardar meio CEP é pior
 * que não guardar, porque parece dado e não resolve endereço nenhum.
 */
export function normalizePostcode(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

/** `64000000` → `64000-000`. */
export function formatPostcode(value: string | null | undefined): string {
  const digits = normalizePostcode(value);
  if (!digits) return value ?? "";
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
