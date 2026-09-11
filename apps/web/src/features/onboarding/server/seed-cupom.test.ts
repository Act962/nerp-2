import { describe, expect, it } from "vitest";
import { presetBlocks } from "@/features/receipt-designer/lib/presets";

/**
 * O cupom que a empresa de teste recebe.
 *
 * O PDV imprime DIRETO do modelo padrão, sem passar pelo editor. Um modelo com
 * `blocks: []` abria a janela de impressão com uma folha em branco depois da
 * primeira venda — que é a pior hora possível para o sistema parecer quebrado.
 */

describe("modelo de cupom semeado", () => {
  it("o preset tem blocos — é o que impede a folha em branco", () => {
    const blocos = presetBlocks("NAO_FISCAL");
    expect(blocos.length).toBeGreaterThan(0);
  });

  it("traz o essencial de um cupom: cabeçalho, itens e total", () => {
    const tipos = new Set(presetBlocks("NAO_FISCAL").map((b) => b.kind));
    expect(tipos.has("header")).toBe(true);
    expect(tipos.has("items")).toBe(true);
    expect(tipos.has("totals")).toBe(true);
  });

  it("clona: mexer no resultado não estraga o preset de quem vier depois", () => {
    const primeiro = presetBlocks("NAO_FISCAL");
    primeiro.length = 0;
    expect(presetBlocks("NAO_FISCAL").length).toBeGreaterThan(0);
  });
});
