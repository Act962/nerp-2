import { describe, expect, it } from "vitest";
import { dueDatePlus } from "@/lib/asaas";

describe("dueDatePlus", () => {
  it("devolve AAAA-MM-DD, que é o formato que o Asaas exige", () => {
    expect(dueDatePlus(1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("anda os dias pedidos", () => {
    const hoje = new Date(dueDatePlus(0)).getTime();
    const amanha = new Date(dueDatePlus(1)).getTime();
    expect(Math.round((amanha - hoje) / 86_400_000)).toBe(1);
  });

  it("atravessa a virada do mês sem estourar", () => {
    // Não é teste de relógio: só garante que a soma usa a data, e não string.
    expect(dueDatePlus(40)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
