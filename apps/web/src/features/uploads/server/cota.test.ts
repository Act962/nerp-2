import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ default: {} }));

const { diaDeHoje } = await import("./cota");

describe("diaDeHoje", () => {
  it("conta o dia no fuso da loja, não em UTC", () => {
    // 01:30 UTC de 11/09 ainda é 22:30 de 10/09 em Fortaleza.
    expect(diaDeHoje(new Date("2026-09-11T01:30:00Z"))).toBe("2026-09-10");
    expect(diaDeHoje(new Date("2026-09-11T12:00:00Z"))).toBe("2026-09-11");
  });
});
