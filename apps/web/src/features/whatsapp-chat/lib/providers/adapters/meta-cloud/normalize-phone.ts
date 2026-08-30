/**
 * Normaliza um telefone para o formato que a Meta espera em `to`: só dígitos,
 * E.164 sem `+`.
 *
 * Por que existe: o `wa_id` que a Meta entrega no webhook pode vir **sem o
 * nono dígito** para contas brasileiras antigas (`558688923098`, 12 dígitos),
 * mesmo que o número real seja `+55 86 9 8892-3098`. Mandar 12 dígitos de
 * volta para o Graph quando o cadastro tem 13 devolve
 * `(#131030) Recipient phone number not in allowed list`.
 *
 * `CrmLead.phone` fica como a Meta deu — ele é a verdade sobre o `wa_id`, não
 * sobre o número humano. A normalização acontece **só na saída**, imediatamente
 * antes do POST.
 *
 * Comportamento:
 *  - tira tudo que não é dígito (`+`, espaço, hífen, parênteses), então
 *    telefone com máscara cosmética não quebra o envio;
 *  - Brasil com 12 dígitos (`55 DD XXXXXXXX`) ganha o `9` entre o DDD e os
 *    oito finais — celular brasileiro tem nove desde 2016;
 *  - qualquer outro caso (13 dígitos, internacional) volta como veio, só sem
 *    formatação. É idempotente.
 *
 * Limitação consciente: um fixo brasileiro de 12 dígitos receberia o `9`
 * indevidamente. Não acontece na prática — linha fixa não recebe WhatsApp.
 */
export function normalizePhoneToMetaE164(phone: string): string {
  const digitos = phone.replace(/\D/g, "");

  if (digitos.length === 12 && digitos.startsWith("55")) {
    const ddd = digitos.slice(2, 4);
    const resto = digitos.slice(4);
    return `55${ddd}9${resto}`;
  }

  return digitos;
}
