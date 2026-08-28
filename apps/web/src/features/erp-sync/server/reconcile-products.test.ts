import { describe, expect, it } from "vitest";
import {
  isRetailBarcode,
  normalizeBarcode,
  reconcileProducts,
  type LocalProductRef,
} from "./reconcile-products";
import type { ExternalProductDTO } from "./connectors/types";

const ext = (
  externalCode: string,
  barcode: string | null,
  isActive = true,
): ExternalProductDTO => ({
  externalCode,
  name: `Produto ${externalCode}`,
  barcode,
  unit: "UN",
  salePrice: 10,
  isActive,
});

const loc = (id: string, barcode: string | null): LocalProductRef => ({
  id,
  barcode,
});

describe("normalizeBarcode", () => {
  it("mantém só dígitos", () => {
    expect(normalizeBarcode(" 789 812-3 ")).toBe("7898123");
  });

  it('trata vazio, nulo e "0" como SEM código', () => {
    // Um zero no cadastro significa "não tem", não "código zero" — casar por
    // ele juntaria produtos sem relação nenhuma.
    expect(normalizeBarcode(null)).toBe("");
    expect(normalizeBarcode("")).toBe("");
    expect(normalizeBarcode("0")).toBe("");
    expect(normalizeBarcode("0000")).toBe("");
    expect(normalizeBarcode("   ")).toBe("");
  });

  it("preserva zeros à esquerda de um código real", () => {
    expect(normalizeBarcode("0789")).toBe("0789");
  });
});

describe("reconcileProducts", () => {
  it("EAN encontrado no local → atualiza, não cria", () => {
    const r = reconcileProducts(
      [ext("100", "7891234567890", false)],
      [loc("prod-1", "7891234567890")],
    );
    expect(r.toUpdate).toEqual([
      { id: "prod-1", erpActive: false, erpCode: "100" },
    ]);
    expect(r.toCreate).toEqual([]);
  });

  it("EAN não encontrado → entra para criar", () => {
    const r = reconcileProducts([ext("200", "7899999999999")], []);
    expect(r.toCreate).toHaveLength(1);
    expect(r.toCreate[0].externalCode).toBe("200");
    expect(r.toUpdate).toEqual([]);
  });

  it("sem EAN → não casa NEM cria; fica no relatório", () => {
    // Criar sem chave de casamento duplicaria o produto no próximo sync.
    const r = reconcileProducts(
      [ext("300", null), ext("301", ""), ext("302", "0")],
      [],
    );
    expect(r.toCreate).toEqual([]);
    expect(r.skippedNoBarcode).toHaveLength(3);
  });

  it("EAN repetido na ORIGEM não vira dois produtos", () => {
    const r = reconcileProducts(
      [ext("400", "7891111111111"), ext("401", "7891111111111")],
      [],
    );
    expect(r.toCreate).toHaveLength(1);
    expect(r.toCreate[0].externalCode).toBe("400");
    expect(r.duplicatesInSource).toHaveLength(1);
    expect(r.duplicatesInSource[0].externalCode).toBe("401");
  });

  it("casa mesmo com formatação diferente dos dois lados", () => {
    const r = reconcileProducts(
      [ext("500", "789-1234 567890")],
      [loc("prod-9", "7891234567890")],
    );
    expect(r.toUpdate).toHaveLength(1);
    expect(r.toCreate).toEqual([]);
  });

  it("produto local sem EAN não atrapalha o casamento dos outros", () => {
    const r = reconcileProducts(
      [ext("600", "7892222222222")],
      [loc("sem-ean", null), loc("prod-x", "7892222222222")],
    );
    expect(r.toUpdate).toEqual([
      { id: "prod-x", erpActive: true, erpCode: "600" },
    ]);
  });

  it("leva o status do ERP para o update, ativo ou inativo", () => {
    const r = reconcileProducts(
      [ext("700", "7893333333333", false), ext("701", "7894444444444", true)],
      [loc("a", "7893333333333"), loc("b", "7894444444444")],
    );
    expect(r.toUpdate.map((u) => u.erpActive)).toEqual([false, true]);
  });

  it("entrada vazia devolve tudo vazio", () => {
    const r = reconcileProducts([], [loc("a", "789")]);
    expect(r).toEqual({
      toUpdate: [],
      toCreate: [],
      skippedNoBarcode: [],
      skippedInvalidBarcode: [],
      duplicatesInSource: [],
    });
  });

  it("código interno no lugar do EAN não vira produto novo", () => {
    // Real no Oracle do Armazém Carvalho: quando o produto não tem etiqueta, o
    // ERP repete o CODPROD no campo de EAN (CODPROD 1 / CODAUXILIAR 1).
    const r = reconcileProducts(
      [ext("1", "1"), ext("8", "8"), ext("9", "54321")],
      [],
    );
    expect(r.toCreate).toEqual([]);
    expect(r.skippedInvalidBarcode).toHaveLength(3);
  });

  it("mas código interno AINDA casa com um local que já o tenha", () => {
    // Casar não cria linha nenhuma: recusar aqui só perderia o status do ERP de
    // um produto que o próprio usuário cadastrou com o código interno.
    const r = reconcileProducts(
      [ext("1", "54321", false)],
      [loc("prod-1", "54321")],
    );
    expect(r.toUpdate).toEqual([
      { id: "prod-1", erpActive: false, erpCode: "1" },
    ]);
    expect(r.skippedInvalidBarcode).toEqual([]);
  });

  it("aceita os comprimentos de varejo e recusa os demais", () => {
    expect([8, 12, 13, 14].map((n) => isRetailBarcode("7".repeat(n)))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    // 9, 10 e 11 dígitos não são padrão de etiqueta nenhum.
    expect(
      [5, 6, 9, 10, 11, 15].map((n) => isRetailBarcode("7".repeat(n))),
    ).toEqual([false, false, false, false, false, false]);
  });

  it("cenário do Armazém Carvalho: milhares casam, alguns sem EAN", () => {
    const externos = Array.from({ length: 500 }, (_, i) =>
      ext(`c${i}`, i < 480 ? `789${String(i).padStart(10, "0")}` : null),
    );
    const locais = Array.from({ length: 300 }, (_, i) =>
      loc(`l${i}`, `789${String(i).padStart(10, "0")}`),
    );
    const r = reconcileProducts(externos, locais);
    expect(r.toUpdate).toHaveLength(300);
    expect(r.toCreate).toHaveLength(180);
    expect(r.skippedNoBarcode).toHaveLength(20);
  });
});
