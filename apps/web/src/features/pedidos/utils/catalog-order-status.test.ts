import { describe, expect, it } from "vitest";
import { SaleStatus } from "@/generated/prisma/enums";
import {
  appendNote,
  approvedAtPdvNote,
  closureFromNotes,
  groupOfStatus,
  rejectedNote,
  statusesOfGroup,
} from "./catalog-order-status";

describe("grupos de status do pedido do catálogo", () => {
  it("põe as etapas depois da confirmação em Confirmados", () => {
    expect(groupOfStatus(SaleStatus.PROCESSING)).toBe("CONFIRMED");
    expect(groupOfStatus(SaleStatus.COMPLETED)).toBe("CONFIRMED");
    expect(statusesOfGroup("PENDING")).toEqual([SaleStatus.PENDING_APPROVAL]);
  });

  it("não classifica rascunho", () => {
    expect(groupOfStatus(SaleStatus.DRAFT)).toBeNull();
  });
});

describe("closureFromNotes", () => {
  it("reconhece o pedido que virou venda no PDV", () => {
    const notes = appendNote("Sem cebola", approvedAtPdvNote("Ana"));
    expect(closureFromNotes(notes)).toEqual({ kind: "APPROVED_AT_PDV" });
  });

  it("devolve o motivo da recusa, mesmo com dois-pontos no motivo", () => {
    const notes = appendNote(null, rejectedNote("Ana", "Sem estoque: acabou"));
    expect(closureFromNotes(notes)).toEqual({
      kind: "REJECTED",
      reason: "Sem estoque: acabou",
    });
  });

  it("ignora nota que não fecha o pedido", () => {
    expect(closureFromNotes("Entregar à tarde")).toBeNull();
    expect(closureFromNotes(null)).toBeNull();
  });
});
