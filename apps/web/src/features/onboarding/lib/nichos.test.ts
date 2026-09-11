import { describe, expect, it } from "vitest";
import { PAGE_PERMISSION_KEYS } from "@/lib/permissions";
import {
  INTERESSES_PADRAO,
  limparRamoLivre,
  MAX_RAMO_LIVRE,
  NICHO_IDS,
  NICHOS,
  nichoPorId,
} from "./nichos";
import { SOLUCOES } from "./solucoes";

/**
 * O ramo decide o que vem pré-marcado, e o pré-marcado vira o guia do
 * dashboard. Um ramo sem soluções é uma tela dizendo "vire-se".
 */

describe("catálogo de ramos", () => {
  it("todo id tem definição, e toda definição tem soluções", () => {
    for (const id of NICHO_IDS) {
      const nicho = nichoPorId(id);
      expect(nicho, id).not.toBeNull();
      expect(nicho?.interesses.length, id).toBeGreaterThan(0);
    }
    expect(NICHOS).toHaveLength(NICHO_IDS.length);
  });

  it('"outro" existe — quem não é nenhum dos seis tem o que responder', () => {
    const outro = nichoPorId("outro");
    expect(outro).not.toBeNull();
    expect(outro?.interesses).toEqual(INTERESSES_PADRAO);
  });

  it("toda solução pré-marcada existe no catálogo de soluções", () => {
    const conhecidas = new Set(SOLUCOES.map((s) => s.id));
    for (const nicho of NICHOS) {
      for (const id of nicho.interesses) {
        expect(conhecidas.has(id), `${nicho.id} → ${id}`).toBe(true);
      }
    }
  });

  it("o conjunto padrão aponta para módulos que existem", () => {
    const chaves = new Set<string>(PAGE_PERMISSION_KEYS);
    for (const id of INTERESSES_PADRAO) {
      const solucao = SOLUCOES.find((s) => s.id === id);
      expect(solucao, id).toBeTruthy();
      // `modulo` pode ser nulo (solução sem página própria); o que não pode é
      // apontar para uma chave que não existe no registro de permissões.
      if (solucao?.modulo) {
        expect(chaves.has(solucao.modulo), `${id} → ${solucao.modulo}`).toBe(
          true,
        );
      }
    }
  });

  it("ramo desconhecido não vira definição", () => {
    expect(nichoPorId("padaria")).toBeNull();
    expect(nichoPorId(null)).toBeNull();
    expect(nichoPorId(undefined)).toBeNull();
  });
});

describe("limparRamoLivre", () => {
  it("tira espaço sobrando e mantém o que foi escrito", () => {
    expect(limparRamoLivre("  Pet shop  ")).toBe("Pet shop");
    expect(limparRamoLivre("distribuidora   de bebidas")).toBe(
      "distribuidora de bebidas",
    );
  });

  it("vazio é o mesmo que não ter dito", () => {
    expect(limparRamoLivre("")).toBeNull();
    expect(limparRamoLivre("   ")).toBeNull();
    expect(limparRamoLivre(null)).toBeNull();
    expect(limparRamoLivre(undefined)).toBeNull();
  });

  it("caractere de controle não chega ao banco", () => {
    const comQuebra = ["pet", "shop"].join(String.fromCharCode(10));
    expect(limparRamoLivre(comQuebra)).toBe("pet shop");
    const comNulo = ["pet", "shop"].join(String.fromCharCode(0));
    expect(limparRamoLivre(comNulo)).toBe("pet shop");
  });

  it("corta no limite da coluna", () => {
    const longo = "a".repeat(MAX_RAMO_LIVRE + 50);
    expect(limparRamoLivre(longo)?.length).toBe(MAX_RAMO_LIVRE);
  });
});
