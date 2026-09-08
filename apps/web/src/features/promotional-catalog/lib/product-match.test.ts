import { describe, expect, it } from "vitest";
import {
  indexProducts,
  lookupByName,
  nameSimilarity,
  parseName,
} from "./product-match";

// Regressão do encarte "SET 08 A 20.09" (set/2026): a planilha trazia 17
// produtos com o nome IDÊNTICO ao do cadastro e o casamento achou 3. A busca
// montava a chave sem acento e sem pontuação ("CAFES CAFE") e procurava esse
// termo cru na coluna do banco ("Cafes - Café Santa Clara..."), que nunca
// contém a substring. Sobreviviam só os nomes cujas duas primeiras palavras
// são separadas por espaço simples e sem acento.
const CADASTRO = [
  "Achocolatado - 3Corações - Refil - 370g",
  "Achocolatado - 3Corações - Refil - 400G",
  "Achocolatado - 3Corações - Refil - 560G",
  "Achocolatado - 3Corações - Refil - 700g",
  "Achocolatado - 3Corações - Refil - 700G",
  "Café Leite 3C 300 gr",
  "Café Leite Sc 300 gr",
  "Café Leite Sc 330 gr",
  "Cafes - Café Santa Clara Extra Forte 250G",
  "Cappuccino - Santa Clara - Pote - 200G",
  "Cappuccino pronto - Pronto - POWER WAY",
  "Capsula - Tres",
  "Flocao Milho Dona Clara 500g",
  "Leite Vegetal",
  "Refresco - Frisco - Tradicional",
  "Soluveis - Kimimo - Refil - 40G",
  "Soluveis - Santa Clara - Refil - 40G",
].map((name, i) => ({ id: `p${i}`, name }));

const index = indexProducts(CADASTRO);

describe("parseName", () => {
  it("separa a gramatura do resto do nome", () => {
    expect(parseName("Cafes - Café Santa Clara Extra Forte 250G")).toEqual({
      tokens: ["CAFES", "CAFE", "SANTA", "CLARA", "EXTRA", "FORTE"],
      size: "250G",
    });
  });

  it("junta valor e unidade escritos separados", () => {
    expect(parseName("Café Leite Sc 300 gr").size).toBe("300G");
    expect(parseName("Café Leite Sc 330 gr").size).toBe("330G");
  });

  it("não confunde número colado na marca com gramatura", () => {
    const parsed = parseName("Achocolatado - 3Corações - Refil - 700G");
    expect(parsed.size).toBe("700G");
    expect(parsed.tokens).toContain("3CORACOES");
  });

  it("aceita nome sem gramatura", () => {
    expect(parseName("Refresco - Frisco - Tradicional").size).toBeNull();
  });
});

describe("nameSimilarity", () => {
  it("zera quando a gramatura difere", () => {
    const a = parseName("Achocolatado - 3Corações - Refil - 400G");
    const b = parseName("Achocolatado - 3Corações - Refil - 700G");
    expect(nameSimilarity(a, b)).toBe(0);
  });

  it("recusa marca diferente com o resto igual", () => {
    const a = parseName("Soluveis - Santa Clara - Refil - 40G");
    const b = parseName("Soluveis - Kimimo - Refil - 40G");
    expect(nameSimilarity(a, b)).toBeLessThan(0.7);
  });
});

describe("lookupByName", () => {
  it("casa os 17 nomes do encarte com o cadastro", () => {
    for (const { name } of CADASTRO) {
      const hit = lookupByName(index, name);
      expect(hit, name).not.toBeNull();
      expect(hit?.exact, name).toBe(true);
    }
  });

  it("casa a gramatura certa entre as variações do achocolatado", () => {
    for (const size of ["370g", "400G", "560G"]) {
      const name = `Achocolatado - 3Corações - Refil - ${size}`;
      expect(lookupByName(index, name)?.product.name).toBe(name);
    }
  });

  it("marca ambíguo quando o cadastro tem o nome duplicado", () => {
    // "700g" e "700G" são dois produtos distintos no banco.
    const hit = lookupByName(index, "Achocolatado - 3Corações - Refil - 700G");
    expect(hit?.ambiguous).toBe(true);
    expect(hit?.alternatives).toHaveLength(1);
  });

  it("acha por palavras quando falta o prefixo de categoria", () => {
    const hit = lookupByName(index, "Café Santa Clara Extra Forte 250G");
    expect(hit?.exact).toBe(false);
    expect(hit?.product.name).toBe("Cafes - Café Santa Clara Extra Forte 250G");
  });

  it("não inventa palpite para produto que não existe", () => {
    expect(lookupByName(index, "Biscoito Recheado Morango 130G")).toBeNull();
  });

  it("não troca Santa Clara por Kimimo quando o certo não existe", () => {
    const semSantaClara = indexProducts(
      CADASTRO.filter((p) => p.name !== "Soluveis - Santa Clara - Refil - 40G"),
    );
    expect(
      lookupByName(semSantaClara, "Soluveis - Santa Clara - Refil - 40G"),
    ).toBeNull();
  });
});
