import { describe, expect, it } from "vitest";
import {
  diaDaSemanaDaData,
  gerarEncaixes,
  paredeDoInstante,
  paredeParaUtc,
} from "./horarios";

describe("parede ↔ UTC", () => {
  it("09:00 na loja é 12:00 em UTC", () => {
    // Fortaleza é UTC−3 o ano todo desde o fim do horário de verão.
    expect(paredeParaUtc("2026-09-02", 9 * 60).toISOString()).toBe(
      "2026-09-02T12:00:00.000Z",
    );
  });

  it("volta ao mesmo horário na ida e na volta", () => {
    const instante = paredeParaUtc("2026-09-02", 8 * 60 + 30);
    expect(paredeDoInstante(instante)).toEqual({
      data: "2026-09-02",
      minutos: 8 * 60 + 30,
    });
  });

  it("22:00 da loja ainda é o mesmo dia, não o seguinte", () => {
    // Em UTC já é 01:00 do dia 3. Errar isto joga o compromisso do fim do
    // expediente para o dia errado na agenda.
    const instante = paredeParaUtc("2026-09-02", 22 * 60);
    expect(instante.toISOString()).toBe("2026-09-03T01:00:00.000Z");
    expect(paredeDoInstante(instante).data).toBe("2026-09-02");
  });

  it("nomeia o dia da semana pelo calendário, não pelo fuso da máquina", () => {
    expect(diaDaSemanaDaData("2026-09-02")).toBe("WEDNESDAY");
    expect(diaDaSemanaDaData("2026-09-06")).toBe("SUNDAY");
  });
});

describe("gerarEncaixes", () => {
  const agora = new Date("2026-09-02T09:30:00.000Z"); // 06:30 na loja

  it("quebra a faixa em encaixes que cabem inteiros", () => {
    const encaixes = gerarEncaixes({
      data: "2026-09-02",
      duracaoMin: 60,
      faixas: [{ startTime: "08:00", endTime: "12:00" }],
      ocupados: [],
      agora,
    });

    // 12:00 NÃO entra: a faixa vai até as 12:00, e um encaixe começando ali
    // terminaria às 13:00 — fora do que a agenda anunciou.
    expect(encaixes.map((e) => e.inicio)).toEqual([
      "08:00",
      "09:00",
      "10:00",
      "11:00",
    ]);
    expect(encaixes.at(-1)?.fim).toBe("12:00");
  });

  it("descarta o resto que não completa um encaixe", () => {
    const encaixes = gerarEncaixes({
      data: "2026-09-02",
      duracaoMin: 45,
      faixas: [{ startTime: "08:00", endTime: "10:00" }],
      ocupados: [],
      agora,
    });
    // 09:30 terminaria às 10:15, depois do fim da faixa — fica de fora, e os
    // 30 minutos que sobram no fim do dia simplesmente não são oferecidos.
    expect(encaixes.map((e) => e.inicio)).toEqual(["08:00", "08:45"]);
  });

  it("junta as faixas do dia sem repetir horário", () => {
    const encaixes = gerarEncaixes({
      data: "2026-09-02",
      duracaoMin: 60,
      faixas: [
        { startTime: "08:00", endTime: "10:00" },
        { startTime: "14:00", endTime: "16:00" },
        // Sobreposta com a primeira: não pode duplicar 08:00 e 09:00.
        { startTime: "08:00", endTime: "09:00" },
      ],
      ocupados: [],
      agora,
    });
    expect(encaixes.map((e) => e.inicio)).toEqual([
      "08:00",
      "09:00",
      "14:00",
      "15:00",
    ]);
  });

  it("marca como ocupado o encaixe que colide com compromisso existente", () => {
    const encaixes = gerarEncaixes({
      data: "2026-09-02",
      duracaoMin: 60,
      faixas: [{ startTime: "08:00", endTime: "11:00" }],
      ocupados: [
        {
          startsAt: new Date("2026-09-02T12:30:00.000Z"), // 09:30 na loja
          endsAt: new Date("2026-09-02T13:00:00.000Z"),
        },
      ],
      agora,
    });

    // O compromisso das 09:30 cai dentro do encaixe das 09:00: colisão
    // parcial também ocupa, senão dois clientes chegam juntos.
    expect(encaixes.filter((e) => e.ocupado).map((e) => e.inicio)).toEqual([
      "09:00",
    ]);
  });

  it("não deixa compromisso cancelado bloquear — quem filtra é a consulta", () => {
    const encaixes = gerarEncaixes({
      data: "2026-09-02",
      duracaoMin: 60,
      faixas: [{ startTime: "08:00", endTime: "10:00" }],
      ocupados: [],
      agora,
    });
    expect(encaixes.every((e) => !e.ocupado)).toBe(true);
  });

  it("marca como passado o que já venceu no relógio da loja", () => {
    const encaixes = gerarEncaixes({
      data: "2026-09-02",
      duracaoMin: 60,
      faixas: [{ startTime: "06:00", endTime: "09:00" }],
      ocupados: [],
      agora: new Date("2026-09-02T10:30:00.000Z"), // 07:30 na loja
    });

    expect(encaixes.filter((e) => e.passado).map((e) => e.inicio)).toEqual([
      "06:00",
      "07:00",
    ]);
    expect(encaixes.filter((e) => !e.passado).map((e) => e.inicio)).toEqual([
      "08:00",
    ]);
  });

  it("ignora faixa invertida ou com hora inválida em vez de estourar", () => {
    const encaixes = gerarEncaixes({
      data: "2026-09-02",
      duracaoMin: 30,
      faixas: [
        { startTime: "18:00", endTime: "09:00" },
        { startTime: "25:00", endTime: "26:00" },
        { startTime: "10:00", endTime: "11:00" },
      ],
      ocupados: [],
      agora,
    });
    expect(encaixes.map((e) => e.inicio)).toEqual(["10:00", "10:30"]);
  });
});
