import { describe, expect, it } from "vitest";
import { PAGE_PERMISSIONS } from "@/lib/permissions";
import { NICHOS } from "./nichos";
import { SOLUCAO_IDS, SOLUCOES } from "./solucoes";
import { passosDoGuia, progressoDoGuia, type StatusDoGuia } from "./trilha";

const zerado: StatusDoGuia = {
  vendas: 0,
  produtosReais: 0,
  catalogos: 0,
  catalogosExportados: 0,
  conversasComAstro: 0,
  whatsappConectado: false,
  campanhas: 0,
  eventos: 0,
  clientesReais: 0,
  metas: 0,
  lojas: 0,
  fotosPdv: 0,
};

describe("guia", () => {
  it("monta passos só das soluções marcadas, mais o passo base, sem repetir", () => {
    const passos = passosDoGuia(["pdv", "whatsapp", "pdv"]);
    const ids = passos.map((p) => p.id);
    expect(ids).toContain("pdv-venda");
    expect(ids).toContain("whatsapp-conectar");
    expect(ids).toContain("base-cliente");
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("trade-loja");
  });

  it("sem interesse marcado ainda há o passo base", () => {
    expect(passosDoGuia([]).map((p) => p.id)).toEqual(["base-cliente"]);
  });

  it("feito vem das contagens", () => {
    const antes = progressoDoGuia(["pdv"], zerado);
    expect(antes.feitos).toBe(0);
    const depois = progressoDoGuia(["pdv"], {
      ...zerado,
      vendas: 1,
      clientesReais: 2,
    });
    expect(depois.feitos).toBe(2);
    expect(depois.total).toBe(2);
  });
});

describe("soluções e nichos", () => {
  it("todo módulo apontado existe em PAGE_PERMISSIONS", () => {
    const chaves = new Set(PAGE_PERMISSIONS.map((p) => p.key as string));
    for (const s of SOLUCOES) {
      if (s.modulo) expect(chaves.has(s.modulo), s.id).toBe(true);
    }
  });

  it("todo interesse pré-marcado por nicho é uma solução conhecida", () => {
    for (const nicho of NICHOS) {
      for (const id of nicho.interesses) {
        expect(SOLUCAO_IDS as readonly string[], `${nicho.id}:${id}`).toContain(
          id,
        );
      }
    }
  });
});
