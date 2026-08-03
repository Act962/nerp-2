/**
 * Documento (CPF/CNPJ) reduzido ao que identifica.
 *
 * Regra do projeto: **só dígitos no banco, máscara só na renderização**. Hoje o
 * documento é gravado cru, com a máscara que a pessoa digitou — o que faz a
 * dedupe por documento nunca disparar quando um lado digitou com pontos e o
 * outro não.
 *
 * Sem `server-only`: o formulário também precisa normalizar antes de enviar.
 */
export function normalizeDocument(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  // 11 = CPF, 14 = CNPJ. Qualquer outro comprimento é digitação incompleta, e
  // aceitá-la criaria uma chave única que bloqueia o dono real do documento.
  if (digits.length !== 11 && digits.length !== 14) return null;
  return digits;
}

/** Dígitos verificadores do CNPJ — a diferença entre "CNPJ" e "14 dígitos". */
export function isValidCnpj(value: string | null | undefined): boolean {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const check = (length: number): number => {
    let sum = 0;
    let weight = length - 7;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * weight;
      weight -= 1;
      if (weight < 2) weight = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** Dígitos verificadores do CPF. */
export function isValidCpf(value: string | null | undefined): boolean {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const check = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

/** Máscara para exibição. A gravação é sempre só de dígitos. */
export { formatCPForCNPJ as formatDocument } from "@/utils/format-cnpj";
