import { describe, expect, it } from "vitest";
import { GS, qrCode } from "./commands";

// O comando de carga do QR declara o tamanho do payload MAIS 3, em
// little-endian. Errar isso é o defeito clássico: o QR sai truncado ou não sai,
// e só aparece quando o payload passa de 255 bytes — que é justamente o caso do
// PIX copia-e-cola.
function bytesDeCarga(comando: number[]) {
  // Os dois primeiros blocos têm 8 bytes cada (tamanho do módulo e correção).
  const inicio = 16;
  return { pL: comando[inicio + 3], pH: comando[inicio + 4] };
}

describe("qrCode", () => {
  it("declara o tamanho correto para payload curto", () => {
    const dados = [...Array(10).keys()];
    const { pL, pH } = bytesDeCarga(qrCode(dados, 6));
    expect(pL).toBe(13); // 10 + 3
    expect(pH).toBe(0);
  });

  it("usa o byte alto quando o payload passa de 255 — o caso do PIX", () => {
    const dados = new Array(300).fill(0x41);
    const { pL, pH } = bytesDeCarga(qrCode(dados, 6));
    // 303 = 0x012F
    expect(pL).toBe(0x2f);
    expect(pH).toBe(0x01);
  });

  it("mantém os dados intactos entre a carga e o comando de impressão", () => {
    const dados = [1, 2, 3];
    const comando = qrCode(dados, 6);
    expect(comando.slice(24, 27)).toEqual([1, 2, 3]);
    expect(comando.slice(-8, -1)).toEqual([
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x31,
      0x51,
    ]);
  });

  it("clampa o tamanho do módulo no intervalo aceito", () => {
    expect(qrCode([1], 99)[7]).toBe(16);
    expect(qrCode([1], 0)[7]).toBe(1);
  });
});
