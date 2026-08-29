import { describe, expect, it } from "vitest";
import { periodRange, STORE_TZ } from "./period-range";

/** Como o recorte aparece para quem está na loja. */
function naLoja(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: STORE_TZ,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

describe("periodRange", () => {
  it('"todos" não recorta nada', () => {
    expect(periodRange("all", new Date("2026-08-29T15:00:00Z"))).toBeNull();
  });

  it('"hoje" vai da meia-noite da loja à meia-noite seguinte', () => {
    const range = periodRange("today", new Date("2026-08-29T15:00:00Z"));
    expect(naLoja(range?.from as Date)).toBe("2026-08-29 00:00:00");
    expect(naLoja(range?.to as Date)).toBe("2026-08-30 00:00:00");
  });

  // O caso que motivou fazer isso no fuso da loja: 23h em Fortaleza já é o dia
  // seguinte em UTC. Recortando por UTC, a venda do fim do expediente cairia no
  // dia errado — e é justamente quando mais se vende.
  it("venda das 23h da loja ainda conta no dia dela", () => {
    const vendaTarde = new Date("2026-08-30T02:00:00Z"); // 23h do dia 29 em Fortaleza
    const range = periodRange("today", vendaTarde);
    expect(naLoja(range?.from as Date)).toBe("2026-08-29 00:00:00");
    expect(vendaTarde >= (range?.from as Date)).toBe(true);
    expect(vendaTarde < (range?.to as Date)).toBe(true);
  });

  it('"esta semana" começa no domingo', () => {
    // 2026-08-29 é um sábado; o domingo daquela semana é 23/08.
    const range = periodRange("week", new Date("2026-08-29T15:00:00Z"));
    expect(naLoja(range?.from as Date)).toBe("2026-08-23 00:00:00");
    expect(naLoja(range?.to as Date)).toBe("2026-08-30 00:00:00");
  });

  it('"este mês" pega do dia 1 ao primeiro dia do mês seguinte', () => {
    const range = periodRange("month", new Date("2026-08-29T15:00:00Z"));
    expect(naLoja(range?.from as Date)).toBe("2026-08-01 00:00:00");
    expect(naLoja(range?.to as Date)).toBe("2026-09-01 00:00:00");
  });

  it("vira o ano sem quebrar", () => {
    const range = periodRange("month", new Date("2026-12-15T15:00:00Z"));
    expect(naLoja(range?.from as Date)).toBe("2026-12-01 00:00:00");
    expect(naLoja(range?.to as Date)).toBe("2027-01-01 00:00:00");
  });

  // Intervalo semiaberto: sem isso, a venda no último milissegundo do dia
  // escaparia de um `lte: 23:59:59.999`.
  it("o fim é exclusivo, então não há fresta entre um dia e o próximo", () => {
    const hoje = periodRange("today", new Date("2026-08-29T15:00:00Z"));
    const amanha = periodRange("today", new Date("2026-08-30T15:00:00Z"));
    expect(hoje?.to.getTime()).toBe(amanha?.from.getTime());
  });
});
