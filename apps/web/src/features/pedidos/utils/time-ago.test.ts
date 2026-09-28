import { describe, expect, it } from "vitest";
import { formatTimeAgo } from "./time-ago";

const NOW = new Date("2026-09-26T12:00:00Z").getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("formatTimeAgo", () => {
  it("escala a unidade conforme o tempo passado", () => {
    expect(formatTimeAgo(ago(30_000), NOW)).toBe("agora");
    expect(formatTimeAgo(ago(5 * 60_000), NOW)).toBe("há 5 min");
    expect(formatTimeAgo(ago(2 * 3_600_000), NOW)).toBe("há 2 h");
    expect(formatTimeAgo(ago(26 * 3_600_000), NOW)).toBe("há 1 dia");
    expect(formatTimeAgo(ago(3 * 86_400_000), NOW)).toBe("há 3 dias");
  });

  it("não devolve tempo negativo com relógio adiantado no servidor", () => {
    expect(formatTimeAgo(ago(-60_000), NOW)).toBe("agora");
  });
});
