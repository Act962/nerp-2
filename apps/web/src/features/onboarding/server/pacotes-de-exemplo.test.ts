import { describe, expect, it } from "vitest";
import { NICHOS } from "../lib/nichos";
import { PACOTES } from "./pacotes-de-exemplo";

/**
 * O pacote é a primeira tela que a pessoa vê depois de entrar. Um produto sem
 * preço, sem categoria ou com SKU repetido não aparece como dado ruim: aparece
 * como o sistema quebrado, no primeiro minuto.
 */

const pacotes = Object.entries(PACOTES);

describe("pacotes de exemplo", () => {
  it("todo nicho aponta para um pacote que existe (ou para a mercearia)", () => {
    for (const nicho of NICHOS) {
      const conhecido = nicho.pacote === "mercearia" || PACOTES[nicho.pacote];
      expect(conhecido, `${nicho.id} → ${nicho.pacote}`).toBeTruthy();
    }
  });

  for (const [nome, pacote] of pacotes) {
    describe(nome, () => {
      it("tem produtos e categorias suficientes para as telas", () => {
        expect(pacote.produtos.length).toBeGreaterThanOrEqual(8);
        expect(pacote.categorias.length).toBeGreaterThanOrEqual(2);
      });

      it("todo produto cai numa categoria do próprio pacote", () => {
        const slugs = new Set(pacote.categorias.map((c) => c.slug));
        for (const produto of pacote.produtos) {
          expect(slugs.has(produto.categoria), produto.name).toBe(true);
        }
      });

      it("SKU, slug e código de barras não se repetem", () => {
        for (const campo of ["sku", "slug", "barcode"] as const) {
          const valores = pacote.produtos.map((p) => p[campo]);
          expect(new Set(valores).size, campo).toBe(valores.length);
        }
      });

      it("todo produto tem foto — encarte com buraco parece quebrado", () => {
        for (const produto of pacote.produtos) {
          expect(produto.foto, produto.name).toBeTruthy();
        }
      });

      it("preço de venda nunca é negativo, e a promoção é menor que ele", () => {
        for (const produto of pacote.produtos) {
          const venda = Number(produto.salePrice);
          expect(venda, produto.name).toBeGreaterThanOrEqual(0);
          if (produto.promotionalPrice) {
            expect(Number(produto.promotionalPrice), produto.name).toBeLessThan(
              venda,
            );
          }
        }
      });

      it("tem ao menos uma promoção — o catálogo de exemplo precisa de oferta", () => {
        const comOferta = pacote.produtos.filter((p) => p.promotionalPrice);
        expect(comOferta.length).toBeGreaterThan(0);
      });

      it("estoque e mínimo são coerentes", () => {
        for (const produto of pacote.produtos) {
          expect(produto.currentStock, produto.name).toBeGreaterThanOrEqual(0);
          expect(produto.minStock, produto.name).toBeGreaterThanOrEqual(0);
        }
      });

      it("nome e descrição existem", () => {
        for (const produto of pacote.produtos) {
          expect(produto.name.trim().length).toBeGreaterThan(0);
          expect(produto.description.trim().length).toBeGreaterThan(0);
        }
      });
    });
  }

  it("SKU não se repete ENTRE pacotes", () => {
    // Não é obrigatório pelo banco (o índice é por organização), mas dois
    // pacotes com o mesmo SKU confundem quem for depurar um seed.
    const todos = pacotes.flatMap(([, p]) => p.produtos.map((x) => x.sku));
    expect(new Set(todos).size).toBe(todos.length);
  });
});
