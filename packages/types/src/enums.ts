/**
 * Espelho MANUAL dos enums de domínio que o device precisa offline.
 *
 * Reescrito à mão de propósito: importar `@/generated/prisma/enums` puxaria o
 * client do Prisma para o bundle do device. O risco é divergir do schema — por
 * isso existe um teste de paridade em `apps/web` que quebra o CI se um enum do
 * Prisma mudar sem atualizar este arquivo.
 */

export const SaleStatus = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  CONFIRMED: "CONFIRMED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

export const PaymentMethod = {
  DINHEIRO: "DINHEIRO",
  PIX: "PIX",
  DEBITO: "DEBITO",
  CREDITO: "CREDITO",
  BOLETO: "BOLETO",
  TRANSFERENCIA: "TRANSFERENCIA",
  OUTROS: "OUTROS",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PersonType = {
  FISICA: "FISICA",
  JURIDICA: "JURIDICA",
} as const;
export type PersonType = (typeof PersonType)[keyof typeof PersonType];

export const MovementType = {
  ENTRADA: "ENTRADA",
  SAIDA: "SAIDA",
  VENDA: "VENDA",
  COMPRA: "COMPRA",
  DEVOLUCAO: "DEVOLUCAO",
  AJUSTE: "AJUSTE",
  TRANSFERENCIA: "TRANSFERENCIA",
  PERDA: "PERDA",
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];
