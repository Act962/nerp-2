import { describe, expect, it } from "vitest";
import { NICHOS, SEM_SUGESTAO_POR_RAMO } from "./nichos";
import {
  CATALOGO_INICIAL,
  type SolucaoDef,
  SOLUCOES,
  solucoesNovasPara,
} from "./solucoes";

/**
 * O nerp vai ganhar soluções, e quem já é cliente nunca as escolheu no
 * onboarding. Os dois primeiros testes daqui são a GUARDA que impede a
 * próxima solução de entrar sem data e sem ramo — sem eles, ela nasceria
 * invisível: fora do "Para você", fora do guia, e sem aviso nenhum.
 */

function solucao(id: string, desde: string): SolucaoDef {
  return {
    id: id as SolucaoDef["id"],
    nome: id,
    descricao: "",
    modulo: null,
    href: "/",
    desde,
  };
}

describe("a guarda do catálogo", () => {
  it("toda solução tem data — sem ela, a novidade não existe para ninguém", () => {
    for (const s of SOLUCOES) {
      expect(s.desde, s.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("toda solução ou é sugerida por um ramo, ou é exceção declarada", () => {
    // Solução que nenhum ramo sugere nunca aparece marcada para ninguém — e
    // isso às vezes é certo (as de trade não servem a supermercado). O que
    // não pode é acontecer sem ninguém decidir. Acrescentar uma solução
    // obriga a escolher um dos dois lados; é para isso que este teste falha.
    const sugeridas = new Set(NICHOS.flatMap((n) => n.interesses));
    const excecoes = new Set(SEM_SUGESTAO_POR_RAMO);
    for (const s of SOLUCOES) {
      expect(
        sugeridas.has(s.id) || excecoes.has(s.id),
        `${s.id}: nenhum ramo a sugere e ela não está em SEM_SUGESTAO_POR_RAMO`,
      ).toBe(true);
    }
  });

  it("a exceção não contradiz um ramo que já sugere a solução", () => {
    const sugeridas = new Set(NICHOS.flatMap((n) => n.interesses));
    for (const id of SEM_SUGESTAO_POR_RAMO) {
      expect(sugeridas.has(id), `${id} está nos dois lugares`).toBe(false);
    }
  });
});

describe("solucoesNovasPara", () => {
  const antiga = solucao("antiga", "2026-01-01");
  const nova = solucao("nova", "2026-12-01");
  const maisNova = solucao("mais-nova", "2027-03-01");
  const catalogo = [antiga, nova, maisNova];

  it("quem entrou antes da solução recebe a novidade", () => {
    const novas = solucoesNovasPara(new Date("2026-06-15"), catalogo);
    expect(novas.map((s) => s.id)).toEqual(["mais-nova", "nova"]);
  });

  it("quem entrou depois não recebe nada — para ele é o catálogo", () => {
    expect(solucoesNovasPara(new Date("2027-06-01"), catalogo)).toEqual([]);
  });

  it("a mais recente vem primeiro", () => {
    const novas = solucoesNovasPara(new Date("2025-01-01"), catalogo);
    expect(novas[0].id).toBe("mais-nova");
  });

  it("quem entrou NO MESMO DIA não recebe aviso", () => {
    // Entrou hoje e a ferramenta saiu hoje: ela já estava lá quando a pessoa
    // escolheu, então não é novidade.
    expect(solucoesNovasPara(new Date("2026-12-01"), catalogo)).toEqual([
      maisNova,
    ]);
  });

  it("o catálogo de hoje não é novidade para ninguém", () => {
    // Nenhuma organização é anterior ao catálogo de origem.
    const naOrigem = new Date(`${CATALOGO_INICIAL}T12:00:00Z`);
    expect(solucoesNovasPara(naOrigem, SOLUCOES)).toEqual([]);
  });
});
