import type { ChargeStatus } from "@/generated/prisma/enums";
import type { EstadoDaCobranca } from "./porta";

/**
 * Status do Asaas → o estado que o domínio entende.
 *
 * A lista do provedor é longa e muda; o que importa para o pedido é uma
 * pergunta só: **posso mandar para a cozinha?** Só `PAGA` responde que sim.
 *
 * O desconhecido cai em `PENDENTE`, nunca em `PAGA`: errar para o lado de
 * "ainda não pagou" atrasa um pedido; errar para o outro entrega comida de
 * graça e some com o rastro.
 */
const DO_ASAAS: Record<string, EstadoDaCobranca> = {
  PENDING: "PENDENTE",
  AWAITING_RISK_ANALYSIS: "PENDENTE",
  CONFIRMED: "PAGA",
  RECEIVED: "PAGA",
  RECEIVED_IN_CASH: "PAGA",
  OVERDUE: "EXPIRADA",
  REFUNDED: "ESTORNADA",
  REFUND_REQUESTED: "ESTORNADA",
  CHARGEBACK_REQUESTED: "ESTORNADA",
  CHARGEBACK_DISPUTE: "ESTORNADA",
  AWAITING_CHARGEBACK_REVERSAL: "ESTORNADA",
  PAYMENT_DELETED: "FALHOU",
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: "FALHOU",
};

export function estadoDoAsaas(status: string): EstadoDaCobranca {
  return DO_ASAAS[status.toUpperCase()] ?? "PENDENTE";
}

const PARA_O_BANCO: Record<EstadoDaCobranca, ChargeStatus> = {
  PENDENTE: "PENDING",
  PAGA: "PAID",
  EXPIRADA: "EXPIRED",
  ESTORNADA: "REFUNDED",
  FALHOU: "FAILED",
};

export function paraChargeStatus(estado: EstadoDaCobranca): ChargeStatus {
  return PARA_O_BANCO[estado];
}

/** Só isto libera a cozinha. */
export function liberaACozinha(estado: EstadoDaCobranca): boolean {
  return estado === "PAGA";
}
