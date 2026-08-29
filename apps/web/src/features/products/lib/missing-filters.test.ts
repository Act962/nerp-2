import { describe, expect, it } from "vitest";
import {
  MISSING_FIELDS,
  MISSING_LABEL,
  type MissingField,
  missingWhere,
} from "./missing-filters";

describe("missing-filters", () => {
  // Guarda contra esquecer metade ao acrescentar um indicador novo: sem isto,
  // um campo sem rótulo apareceria como card em branco.
  it("todo campo tem rótulo e cláusula", () => {
    for (const field of MISSING_FIELDS) {
      expect(MISSING_LABEL[field]).toBeTruthy();
      expect(missingWhere(field)).toBeTypeOf("object");
    }
  });

  it("texto vazio conta como ausente, não só null", () => {
    // Cadastro em massa grava "" em vez de null; contar só null esconderia a
    // maior parte dos itens incompletos.
    for (const campo of ["sku", "barcode"] as const) {
      const where = missingWhere(campo) as { OR?: unknown[] };
      expect(where.OR).toEqual([{ [campo]: null }, { [campo]: "" }]);
    }
  });

  it("sem estoque e sem preço cobrem zero, não só negativo", () => {
    expect(missingWhere("stock")).toEqual({ currentStock: { lte: 0 } });
    expect(missingWhere("price")).toEqual({ salePrice: { lte: 0 } });
  });

  // Ter miniatura OU galeria já rende foto na tela; só é "sem imagem" quem não
  // tem nenhuma das duas.
  it("sem imagem exige miniatura E galeria vazias", () => {
    expect(missingWhere("image")).toEqual({
      thumbnail: "",
      images: { isEmpty: true },
    });
  });

  it("sem categoria é o vínculo nulo", () => {
    expect(missingWhere("category")).toEqual({ categoryId: null });
  });

  it("cobre exatamente os seis indicadores do painel", () => {
    const esperado: MissingField[] = [
      "category",
      "stock",
      "price",
      "sku",
      "barcode",
      "image",
    ];
    expect([...MISSING_FIELDS]).toEqual(esperado);
  });
});
