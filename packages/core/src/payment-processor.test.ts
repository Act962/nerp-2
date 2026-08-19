import { describe, expect, it } from "vitest";
import { createMockPaymentProcessor } from "./adapters/mock-payment-processor";
import {
  canTransitionPayment,
  isResolved,
  type PaymentRequest,
  requiresReconciliation,
} from "./payment";

const req: PaymentRequest = { amount: 100, instrument: "credit" };

describe("MockPaymentProcessor", () => {
  it("start devolve in_progress e status aprova (sucesso, com autorização/NSU)", async () => {
    const p = createMockPaymentProcessor({ outcome: "approve" });
    const started = await p.start(req);
    expect(started.state).toBe("in_progress");

    const resolved = await p.status(started.id);
    expect(resolved.state).toBe("approved");
    expect(resolved.authorization).toBeTruthy();
    expect(resolved.nsu).toBeTruthy();
  });

  it("simula erro do processador", async () => {
    const p = createMockPaymentProcessor({ outcome: "error" });
    const s = await p.start(req);
    expect((await p.status(s.id)).state).toBe("error");
  });

  it("timeout NÃO é recusa e é reconciliável para aprovado", async () => {
    const p = createMockPaymentProcessor({
      outcome: "timeout",
      reconcileTo: "approve",
    });
    const s = await p.start(req);

    const t = await p.status(s.id);
    expect(t.state).toBe("timeout");
    expect(requiresReconciliation(t.state)).toBe(true);
    expect(isResolved(t.state)).toBe(false);

    const rec = await p.reconcile(s.id);
    expect(rec.state).toBe("approved");
    expect(rec.authorization).toBeTruthy();
  });

  it("reconcile pode revelar recusa", async () => {
    const p = createMockPaymentProcessor({
      outcome: "timeout",
      reconcileTo: "decline",
    });
    const s = await p.start(req);
    await p.status(s.id);
    expect((await p.reconcile(s.id)).state).toBe("declined");
  });

  it("aguarda pollsUntilResolve consultas antes de resolver", async () => {
    const p = createMockPaymentProcessor({
      outcome: "approve",
      pollsUntilResolve: 3,
    });
    const s = await p.start(req);
    expect((await p.status(s.id)).state).toBe("in_progress");
    expect((await p.status(s.id)).state).toBe("in_progress");
    expect((await p.status(s.id)).state).toBe("approved");
  });

  it("cancel aborta em andamento e é no-op depois de resolvido", async () => {
    const p = createMockPaymentProcessor({ outcome: "approve" });
    const emAndamento = await p.start(req);
    expect((await p.cancel(emAndamento.id)).state).toBe("cancelled");

    const resolvido = await p.start(req);
    await p.status(resolvido.id); // aprova
    expect((await p.cancel(resolvido.id)).state).toBe("approved"); // no-op
  });

  it("outcome como função varia por requisição", async () => {
    const p = createMockPaymentProcessor({
      outcome: (r) => (r.instrument === "pix" ? "approve" : "decline"),
    });
    const pix = await p.start({ amount: 10, instrument: "pix" });
    const credito = await p.start({ amount: 10, instrument: "credit" });
    expect((await p.status(pix.id)).state).toBe("approved");
    expect((await p.status(credito.id)).state).toBe("declined");
  });

  it("status/cancel/reconcile em id inexistente lançam", async () => {
    const p = createMockPaymentProcessor();
    await expect(p.status("nao-existe")).rejects.toThrow();
  });

  it("máquina de estados barra transições ilegais e permite timeout→approved", () => {
    expect(canTransitionPayment("approved", "in_progress")).toBe(false);
    expect(canTransitionPayment("in_progress", "approved")).toBe(true);
    expect(canTransitionPayment("timeout", "approved")).toBe(true);
    expect(canTransitionPayment("declined", "approved")).toBe(false);
  });
});
