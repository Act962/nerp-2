import { describe, expect, it } from "vitest";
import { rotuloDaMesa } from "./rotulo-da-mesa";

describe("rotuloDaMesa", () => {
  it("prefixa quando é só o número, como nos pedidos antigos", () => {
    expect(rotuloDaMesa("18")).toBe("Mesa 18");
  });

  it("não repete o rótulo que já veio pronto", () => {
    expect(rotuloDaMesa("Mesa 3")).toBe("Mesa 3");
  });

  it("deixa em paz a identificação do cardápio", () => {
    expect(rotuloDaMesa("Pedido #42 · João")).toBe("Pedido #42 · João");
  });

  it("deixa em paz o texto livre do balcão", () => {
    expect(rotuloDaMesa("Balcão 3")).toBe("Balcão 3");
  });

  it("aguenta vazio sem imprimir 'Mesa undefined'", () => {
    expect(rotuloDaMesa("   ")).toBe("Mesa");
  });
});
