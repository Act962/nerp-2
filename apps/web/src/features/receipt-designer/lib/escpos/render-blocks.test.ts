import { describe, expect, it } from "vitest";
import { presetBlocks, SAMPLE_DATA } from "../presets";
import type { ReceiptBlock, ReceiptSaleData } from "../types";
import { ESC, GS } from "./commands";
import { encodeText } from "./encoding";
import { blocksToEscpos } from "./render-blocks";

// Decodifica de volta só o texto imprimível, para as asserções lerem como o
// cupom que sai no papel em vez de uma sopa de bytes.
function comoTexto(bytes: Uint8Array): string {
  let saida = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === ESC || b === GS) {
      // Pula o comando inteiro de forma grosseira: basta para ler o texto.
      i += b === ESC ? 2 : 2;
      continue;
    }
    if (b === 0x0a) saida += "\n";
    else if (b >= 0x20 && b <= 0x7e) saida += String.fromCharCode(b);
  }
  return saida;
}

function contemSequencia(haystack: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

describe("blocksToEscpos", () => {
  const blocks = presetBlocks("NAO_FISCAL");

  it("começa reinicializando a impressora", () => {
    const bytes = blocksToEscpos(blocks, SAMPLE_DATA, "MM80");
    expect([bytes[0], bytes[1]]).toEqual([ESC, 0x40]);
  });

  it("declara a tabela de caracteres logo depois do reset", () => {
    const bytes = blocksToEscpos(blocks, SAMPLE_DATA, "MM80", {
      codepage: "CP860",
    });
    // ESC t 3 = CP860
    expect([bytes[2], bytes[3], bytes[4]]).toEqual([ESC, 0x74, 3]);
  });

  it("imprime todos os itens da venda", () => {
    const bytes = blocksToEscpos(blocks, SAMPLE_DATA, "MM80");
    for (const item of SAMPLE_DATA.items) {
      // Compara BYTES: o nome acentuado não existe em ASCII depois de
      // codificado, então procurar texto aqui testaria o decodificador do
      // teste, não o cupom.
      expect(contemSequencia(bytes, encodeText(item.name, "CP860"))).toBe(true);
    }
  });

  it("resolve as variáveis do template com a mesma função do renderer CSS", () => {
    const texto = comoTexto(blocksToEscpos(blocks, SAMPLE_DATA, "MM80"));
    expect(texto).toContain(String(SAMPLE_DATA.sale.number));
    expect(texto).not.toContain("{{numero}}");
    expect(texto).not.toContain("{{");
  });

  it("não imprime linha de desconto quando não há desconto", () => {
    const semDesconto: ReceiptSaleData = { ...SAMPLE_DATA, discount: 0 };
    const texto = comoTexto(blocksToEscpos(blocks, semDesconto, "MM80"));
    expect(texto).not.toContain("Desconto");
  });

  it("imprime a observação do item, que é o que a cozinha lê", () => {
    const comObservacao: ReceiptSaleData = {
      ...SAMPLE_DATA,
      items: [{ ...SAMPLE_DATA.items[0], notes: "sem cebola" }],
    };
    const texto = comoTexto(
      blocksToEscpos(comObservacao_blocks(), comObservacao, "MM80"),
    );
    expect(texto).toContain("sem cebola");
  });

  it("respeita a largura do papel de 58mm", () => {
    const texto = comoTexto(blocksToEscpos(blocks, SAMPLE_DATA, "MM58"));
    for (const linha of texto.split("\n")) {
      expect([...linha].length).toBeLessThanOrEqual(32);
    }
  });

  it("termina avançando o papel e só corta quando pedido", () => {
    const semCorte = blocksToEscpos(blocks, SAMPLE_DATA, "MM80");
    const comCorte = blocksToEscpos(blocks, SAMPLE_DATA, "MM80", { cut: true });
    // ESC d n
    expect([...semCorte.slice(-3)]).toEqual([ESC, 0x64, 4]);
    expect([...comCorte.slice(-4)]).toEqual([GS, 0x56, 66, 0]);
  });

  it("cai para o endereço em texto quando a impressora não tem QR", () => {
    const qrBlock: ReceiptBlock[] = [
      {
        id: "qr",
        kind: "qr",
        source: "custom",
        value: "https://orbita.app/pedido/abc",
        caption: "Acompanhe seu pedido",
        size: "md",
      },
    ];
    const texto = comoTexto(
      blocksToEscpos(qrBlock, SAMPLE_DATA, "MM80", { qrSupported: false }),
    );
    expect(texto).toContain("https://orbita.app/pedido/abc");
  });
});

function comObservacao_blocks(): ReceiptBlock[] {
  return [{ id: "items", kind: "items", showSku: false, showUnitPrice: true }];
}
