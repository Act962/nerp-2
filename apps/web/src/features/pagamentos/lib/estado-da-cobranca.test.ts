import { describe, expect, it } from "vitest";
import {
  estadoDoAsaas,
  liberaACozinha,
  paraChargeStatus,
} from "./estado-da-cobranca";

describe("estadoDoAsaas", () => {
  it("reconhece as três formas de pago do Asaas", () => {
    // CONFIRMED é cartão autorizado; RECEIVED é dinheiro compensado;
    // RECEIVED_IN_CASH é baixa manual. Os três valem como pago.
    expect(estadoDoAsaas("CONFIRMED")).toBe("PAGA");
    expect(estadoDoAsaas("RECEIVED")).toBe("PAGA");
    expect(estadoDoAsaas("RECEIVED_IN_CASH")).toBe("PAGA");
  });

  it("não confunde vencido com recusado", () => {
    // Vencido o cliente ainda pode refazer; recusado precisa de outra forma.
    expect(estadoDoAsaas("OVERDUE")).toBe("EXPIRADA");
    expect(estadoDoAsaas("PAYMENT_REPROVED_BY_RISK_ANALYSIS")).toBe("FALHOU");
  });

  it("trata estorno e disputa como estorno", () => {
    expect(estadoDoAsaas("REFUNDED")).toBe("ESTORNADA");
    expect(estadoDoAsaas("CHARGEBACK_REQUESTED")).toBe("ESTORNADA");
  });

  it("status desconhecido NUNCA vira pago", () => {
    // É a regra que impede comida de sair de graça quando o Asaas inventa um
    // status novo: errar para "ainda não pagou" atrasa um pedido; errar para o
    // outro lado entrega o hambúrguer e some com o rastro.
    expect(estadoDoAsaas("UM_STATUS_QUE_NAO_EXISTE")).toBe("PENDENTE");
    expect(estadoDoAsaas("")).toBe("PENDENTE");
  });

  it("não depende de caixa alta", () => {
    expect(estadoDoAsaas("received")).toBe("PAGA");
  });
});

describe("liberaACozinha", () => {
  it("só o pago libera", () => {
    expect(liberaACozinha("PAGA")).toBe(true);
    for (const estado of [
      "PENDENTE",
      "EXPIRADA",
      "ESTORNADA",
      "FALHOU",
    ] as const) {
      expect(liberaACozinha(estado)).toBe(false);
    }
  });
});

describe("paraChargeStatus", () => {
  it("cobre todos os estados do domínio", () => {
    expect(paraChargeStatus("PENDENTE")).toBe("PENDING");
    expect(paraChargeStatus("PAGA")).toBe("PAID");
    expect(paraChargeStatus("EXPIRADA")).toBe("EXPIRED");
    expect(paraChargeStatus("ESTORNADA")).toBe("REFUNDED");
    expect(paraChargeStatus("FALHOU")).toBe("FAILED");
  });
});
