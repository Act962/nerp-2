import { describe, expect, it } from "vitest";
import { intervaloAnterior, intervaloDoPeriodo } from "./periodo";

/** Fortaleza é UTC−3 o ano todo: meia-noite local é 03:00 UTC. */
const dia = (iso: string) => `${iso}T03:00:00.000Z`;

describe("intervaloDoPeriodo", () => {
  // 01:00 UTC de 10/09 ainda é 22:00 de 09/09 em Fortaleza.
  const noiteDeOntem = new Date("2026-09-10T01:00:00Z");
  const meioDia = new Date("2026-09-10T15:00:00Z");

  it("hoje termina onde amanhã começa, no fuso da loja", () => {
    const hoje = intervaloDoPeriodo("hoje", meioDia);
    expect(hoje.from.toISOString()).toBe(dia("2026-09-10"));
    expect(hoje.to.toISOString()).toBe(dia("2026-09-11"));
  });

  it("as 22h de Fortaleza ainda são hoje, mesmo já sendo amanhã em UTC", () => {
    const hoje = intervaloDoPeriodo("hoje", noiteDeOntem);
    expect(hoje.from.toISOString()).toBe(dia("2026-09-09"));
    expect(hoje.to.toISOString()).toBe(dia("2026-09-10"));
  });

  it("ontem é o dia anterior fechado", () => {
    const ontem = intervaloDoPeriodo("ontem", meioDia);
    expect(ontem.from.toISOString()).toBe(dia("2026-09-09"));
    expect(ontem.to.toISOString()).toBe(dia("2026-09-10"));
  });

  it("7d e 30d incluem hoje", () => {
    const sete = intervaloDoPeriodo("7d", meioDia);
    expect(sete.from.toISOString()).toBe(dia("2026-09-04"));
    expect(sete.to.toISOString()).toBe(dia("2026-09-11"));

    const trinta = intervaloDoPeriodo("30d", meioDia);
    expect(trinta.from.toISOString()).toBe(dia("2026-08-12"));
    expect(trinta.to.toISOString()).toBe(dia("2026-09-11"));
  });

  it("mês começa no dia 1 da loja; mês anterior é o mês fechado", () => {
    const mes = intervaloDoPeriodo("mes", meioDia);
    expect(mes.from.toISOString()).toBe(dia("2026-09-01"));
    expect(mes.to.toISOString()).toBe(dia("2026-09-11"));

    const anterior = intervaloDoPeriodo("mes_anterior", meioDia);
    expect(anterior.from.toISOString()).toBe(dia("2026-08-01"));
    expect(anterior.to.toISOString()).toBe(dia("2026-09-01"));
  });

  it("no dia 1, o mês anterior é o mês inteiro de trás", () => {
    const primeiroDeMarco = new Date("2026-03-01T15:00:00Z");
    const anterior = intervaloDoPeriodo("mes_anterior", primeiroDeMarco);
    expect(anterior.from.toISOString()).toBe(dia("2026-02-01"));
    expect(anterior.to.toISOString()).toBe(dia("2026-03-01"));
  });
});

describe("intervaloAnterior", () => {
  it("tem o mesmo tamanho e termina onde o atual começa", () => {
    const atual = intervaloDoPeriodo("7d", new Date("2026-09-10T15:00:00Z"));
    const anterior = intervaloAnterior(atual);
    expect(anterior.to).toEqual(atual.from);
    expect(anterior.to.getTime() - anterior.from.getTime()).toBe(
      atual.to.getTime() - atual.from.getTime(),
    );
  });
});
