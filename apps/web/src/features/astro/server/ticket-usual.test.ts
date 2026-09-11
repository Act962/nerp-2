import { describe, expect, it } from "vitest";
import {
  calcularTicketUsual,
  DIAS_MINIMOS,
  METODO_DO_TICKET,
} from "./ticket-usual";

/**
 * O ticket usual decide duas coisas: o que a tool responde e quando o Astro
 * avisa sozinho. Errar o corte aqui é avisar a loja de um problema que não
 * existe — ou calar sobre um que existe.
 */

describe("calcularTicketUsual", () => {
  it("com poucos dias de venda, não há usual", () => {
    const poucos = Array.from({ length: DIAS_MINIMOS - 1 }, () => 100);
    expect(calcularTicketUsual(poucos)).toBeNull();
    expect(calcularTicketUsual([])).toBeNull();
  });

  it("série constante tem desvio zero: o corte é a própria média", () => {
    const usual = calcularTicketUsual(Array.from({ length: 10 }, () => 80));
    expect(usual?.media).toBe(80);
    expect(usual?.desvio).toBe(0);
    expect(usual?.corte).toBe(80);
    expect(usual?.diasAnalisados).toBe(10);
  });

  it("o corte é a média menos um desvio", () => {
    // Média 100; desvio amostral de [90,110] repetidos é 10,54.
    const tickets = [90, 110, 90, 110, 90, 110, 90, 110];
    const usual = calcularTicketUsual(tickets);
    expect(usual).not.toBeNull();
    if (!usual) return;

    expect(usual.media).toBe(100);
    expect(usual.corte).toBeCloseTo(usual.media - usual.desvio, 10);
    // Um dia de 70 está abaixo do corte; um de 95 não está.
    expect(70).toBeLessThan(usual.corte);
    expect(95).toBeGreaterThan(usual.corte);
  });

  it("um dia muito fora puxa o desvio e alarga a tolerância", () => {
    const normal = [100, 100, 100, 100, 100, 100, 100, 100];
    const comOutlier = [...normal.slice(0, 7), 300];

    const semOutlier = calcularTicketUsual(normal);
    const comEle = calcularTicketUsual(comOutlier);
    expect(semOutlier).not.toBeNull();
    expect(comEle).not.toBeNull();
    if (!semOutlier || !comEle) return;

    // É o comportamento esperado do método, e é por isso que ele vai
    // declarado na resposta: com um dia atípico, o alarme fica menos sensível.
    expect(comEle.desvio).toBeGreaterThan(semOutlier.desvio);
    expect(comEle.corte).toBeLessThan(comEle.media);
  });

  it("o método é declarado junto — número de anomalia sem método é chute", () => {
    expect(METODO_DO_TICKET).toMatch(/90 dias/);
    expect(METODO_DO_TICKET).toMatch(/desvio-padrão/);
  });
});
