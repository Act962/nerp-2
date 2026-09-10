import { describe, expect, it } from "vitest";
import { STATUS_VENDA_VALIDA, whereVendaValida } from "./venda-valida";

describe("whereVendaValida", () => {
  it("conta o que foi fechado e ignora rascunho, aprovação pendente e cancelada", () => {
    expect([...STATUS_VENDA_VALIDA]).toEqual([
      "CONFIRMED",
      "PROCESSING",
      "COMPLETED",
    ]);
    expect(STATUS_VENDA_VALIDA).not.toContain("DRAFT");
    expect(STATUS_VENDA_VALIDA).not.toContain("PENDING_APPROVAL");
    expect(STATUS_VENDA_VALIDA).not.toContain("CANCELLED");
  });

  it("sempre escopa pela organização", () => {
    const where = whereVendaValida("org-1");
    expect(where.organizationId).toBe("org-1");
    expect(where).not.toHaveProperty("createdAt");
  });

  it("com intervalo, filtra por createdAt semiaberto", () => {
    const from = new Date("2026-09-01T03:00:00Z");
    const to = new Date("2026-10-01T03:00:00Z");
    expect(whereVendaValida("org-1", { from, to }).createdAt).toEqual({
      gte: from,
      lt: to,
    });
  });
});
