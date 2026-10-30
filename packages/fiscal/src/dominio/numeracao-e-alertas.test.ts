import { describe, expect, it } from "vitest";
import { alertasFiscais } from "./alertas";
import {
  JANELA_REENVIO_MS,
  agruparEmFaixas,
  numeroOcupado,
  numerosPulados,
} from "./numeracao";

const AGORA = new Date("2026-11-03T13:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;

describe("numerosPulados", () => {
  it("agrupa os buracos em faixas contínuas", () => {
    expect(agruparEmFaixas([8, 1, 2, 3, 7, 2])).toEqual([
      { inicio: 1, fim: 3 },
      { inicio: 7, fim: 8 },
    ]);
  });

  it("devolve o que foi reservado e não virou nota, descontando o inutilizado", () => {
    expect(
      numerosPulados({
        primeiro: 100,
        proximo: 110,
        ocupados: [100, 101, 104, 109],
        inutilizadas: [{ inicio: 102, fim: 102 }],
      }),
    ).toEqual([
      { inicio: 103, fim: 103 },
      { inicio: 105, fim: 108 },
    ]);
  });

  it("série sem buraco devolve vazio", () => {
    expect(
      numerosPulados({
        primeiro: 1,
        proximo: 4,
        ocupados: [1, 2, 3],
        inutilizadas: [],
      }),
    ).toEqual([]);
  });

  it("rejeitada recente ainda ocupa; antiga e inutilizada não", () => {
    const recente = new Date(AGORA.getTime() - 60_000);
    const antiga = new Date(AGORA.getTime() - JANELA_REENVIO_MS - 1);
    expect(
      numeroOcupado({ status: "REJECTED", ultimaTentativaEm: recente }, AGORA),
    ).toBe(true);
    expect(
      numeroOcupado({ status: "REJECTED", ultimaTentativaEm: antiga }, AGORA),
    ).toBe(false);
    expect(
      numeroOcupado({ status: "VOIDED", ultimaTentativaEm: recente }, AGORA),
    ).toBe(false);
    expect(
      numeroOcupado({ status: "CANCELLED", ultimaTentativaEm: antiga }, AGORA),
    ).toBe(true);
  });
});

describe("alertasFiscais", () => {
  const vazio = {
    agora: AGORA,
    certificadoVenceEm: null,
    rejeicoesRecentes: [],
    paradas: 0,
    pulados: 0,
  };
  const vence = (dias: number) => new Date(AGORA.getTime() + dias * DIA);

  it("sem pendência, sem alerta", () => {
    expect(alertasFiscais(vazio)).toEqual([]);
  });

  it.each([
    [45, null],
    [30, "info"],
    [15, "aviso"],
    [7, "critico"],
    [-1, "critico"],
  ])("certificado vencendo em %i dias → %s", (dias, nivel) => {
    const alertas = alertasFiscais({
      ...vazio,
      certificadoVenceEm: vence(dias),
    });
    expect(alertas[0]?.nivel ?? null).toBe(nivel);
  });

  it("certificado vencido diz que venceu", () => {
    const [alerta] = alertasFiscais({
      ...vazio,
      certificadoVenceEm: vence(-3),
    });
    expect(alerta.mensagem).toMatch(/venceu em/);
  });

  it("rejeição recorrente só a partir de 3 vezes do mesmo código", () => {
    const r778 = { codigo: "778", motivo: "NCM inexistente" };
    const r373 = { codigo: "373", motivo: "Descrição inválida" };
    const alertas = alertasFiscais({
      ...vazio,
      rejeicoesRecentes: [r778, r778, r778, r373, r373],
    });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].mensagem).toMatch(/778 aconteceu 3 vezes/);
  });

  it("ordena do mais grave ao mais leve", () => {
    const alertas = alertasFiscais({
      ...vazio,
      certificadoVenceEm: vence(3),
      paradas: 2,
      pulados: 4,
    });
    expect(alertas.map((a) => a.tipo)).toEqual([
      "CERTIFICADO",
      "NOTAS_PARADAS",
      "NUMEROS_PULADOS",
    ]);
  });
});
