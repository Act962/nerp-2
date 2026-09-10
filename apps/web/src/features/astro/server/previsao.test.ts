import { describe, expect, it } from "vitest";
import { JANELA_DA_MEDIA, preverSerie } from "./previsao";

const DIA_MS = 86_400_000;

/** Série sintética: `valorPorDiaDaSemana[dow]`, terminando ontem. */
function serie(dias: number, valorPorDiaDaSemana: number[], hoje: Date) {
  const pontos = [];
  for (let i = dias; i >= 1; i--) {
    const data = new Date(hoje.getTime() - i * DIA_MS);
    pontos.push({ data, valor: valorPorDiaDaSemana[data.getUTCDay()] ?? 0 });
  }
  return pontos;
}

const HOJE = new Date("2026-09-10T00:00:00Z"); // quinta

describe("preverSerie", () => {
  it("sem histórico não inventa número", () => {
    const previsao = preverSerie([], 7, HOJE);
    expect(previsao.total).toBe(0);
    expect(previsao.dias).toHaveLength(0);
    expect(previsao.confianca).toBe("baixa");
    expect(previsao.metodo).toMatch(/sem histórico/i);
  });

  it("série constante prevê o mesmo valor todo dia, sem faixa", () => {
    const previsao = preverSerie(
      serie(28, Array(7).fill(100), HOJE),
      7,
      HOJE,
    );
    expect(previsao.media).toBe(100);
    for (const dia of previsao.dias) {
      expect(dia.previsto).toBe(100);
      expect(dia.min).toBe(100);
      expect(dia.max).toBe(100);
    }
    expect(previsao.total).toBe(700);
    expect(previsao.confianca).toBe("alta");
  });

  it("aprende a sazonalidade da semana: sábado dobra, domingo zera", () => {
    // [dom, seg, ter, qua, qui, sex, sáb]
    const porDia = [0, 100, 100, 100, 100, 100, 200];
    const previsao = preverSerie(serie(28, porDia, HOJE), 7, HOJE);

    // Média = (0 + 100*5 + 200) / 7 = 100
    expect(previsao.media).toBe(100);
    expect(previsao.fatoresPorDiaDaSemana[0]).toBe(0); // domingo
    expect(previsao.fatoresPorDiaDaSemana[6]).toBe(2); // sábado
    expect(previsao.fatoresPorDiaDaSemana[1]).toBe(1); // segunda

    const porData = new Map(
      previsao.dias.map((dia) => [dia.data.getUTCDay(), dia.previsto]),
    );
    expect(porData.get(6)).toBe(200);
    expect(porData.get(0)).toBe(0);
    expect(porData.get(3)).toBe(100);
    // Sazonalidade explicada = resíduo zero = faixa colada na previsão.
    expect(previsao.dias.every((dia) => dia.min === dia.previsto)).toBe(true);
  });

  it("usa só a janela recente e marca a confiança pelo histórico que tem", () => {
    const antigos = serie(60, Array(7).fill(10), HOJE).slice(0, 30);
    const recentes = serie(JANELA_DA_MEDIA, Array(7).fill(100), HOJE);
    const previsao = preverSerie([...antigos, ...recentes], 7, HOJE);
    expect(previsao.diasDeHistorico).toBe(JANELA_DA_MEDIA);
    expect(previsao.media).toBe(100);

    expect(preverSerie(serie(10, Array(7).fill(50), HOJE), 7, HOJE).confianca).toBe(
      "baixa",
    );
    expect(preverSerie(serie(20, Array(7).fill(50), HOJE), 7, HOJE).confianca).toBe(
      "media",
    );
  });

  it("a previsão começa amanhã e nunca projeta valor negativo", () => {
    const irregular = serie(28, [0, 10, 300, 5, 400, 2, 0], HOJE);
    const previsao = preverSerie(irregular, 3, HOJE);
    expect(previsao.dias[0]?.data.toISOString().slice(0, 10)).toBe("2026-09-11");
    expect(previsao.dias).toHaveLength(3);
    expect(previsao.dias.every((dia) => dia.min >= 0)).toBe(true);
  });
});
