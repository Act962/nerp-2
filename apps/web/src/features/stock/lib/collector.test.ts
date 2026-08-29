import { describe, expect, it } from "vitest";
import { QUANTITY_LABEL, previewStock } from "./collector";

describe("previewStock", () => {
  describe("entrada", () => {
    it("soma ao saldo", () => {
      expect(previewStock("ENTRADA", 10, 5)).toEqual({
        newStock: 15,
        difference: 5,
      });
    });

    it("recusa quantidade zerada ou negativa", () => {
      expect(previewStock("ENTRADA", 10, 0).error).toBeTruthy();
      expect(previewStock("ENTRADA", 10, -3).error).toBeTruthy();
    });
  });

  describe("saída", () => {
    it("subtrai do saldo", () => {
      expect(previewStock("SAIDA", 10, 4)).toEqual({
        newStock: 6,
        difference: -4,
      });
    });

    // O servidor também recusa; barrar aqui evita a viagem e a mensagem seca.
    it("barra saída maior que o estoque, dizendo quanto há", () => {
      const preview = previewStock("SAIDA", 3, 10);

      expect(preview.error).toContain("3");
      expect(preview.newStock).toBe(3);
    });

    it("permite zerar o estoque exatamente", () => {
      expect(previewStock("SAIDA", 3, 3)).toEqual({
        newStock: 0,
        difference: -3,
      });
    });
  });

  // A diferença que mais gera erro no chão da loja: em inventário o número é
  // QUANTO EXISTE, não quanto moveu.
  describe("inventário", () => {
    it("o número digitado vira o saldo, não é somado", () => {
      expect(previewStock("INVENTARIO", 10, 7)).toEqual({
        newStock: 7,
        difference: -3,
      });
      expect(previewStock("INVENTARIO", 10, 12)).toEqual({
        newStock: 12,
        difference: 2,
      });
    });

    it("aceita contagem zero — prateleira vazia é resultado válido", () => {
      expect(previewStock("INVENTARIO", 8, 0)).toEqual({
        newStock: 0,
        difference: -8,
      });
    });

    it("contagem igual ao sistema não move nada", () => {
      expect(previewStock("INVENTARIO", 10, 10).difference).toBe(0);
    });

    it("recusa contagem negativa", () => {
      expect(previewStock("INVENTARIO", 10, -1).error).toBeTruthy();
    });
  });

  it("sem número digitado, pede a quantidade em vez de calcular", () => {
    expect(previewStock("ENTRADA", 10, Number.NaN).error).toBe(
      "Informe a quantidade",
    );
  });

  // O rótulo mudar junto com a operação é o que evita o erro de significado.
  it("o rótulo da quantidade diz o que o número significa", () => {
    expect(QUANTITY_LABEL.ENTRADA).toMatch(/entrou/);
    expect(QUANTITY_LABEL.SAIDA).toMatch(/saiu/);
    expect(QUANTITY_LABEL.INVENTARIO).toMatch(/contada/);
  });
});
