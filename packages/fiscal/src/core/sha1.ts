/**
 * SHA-1 em TypeScript puro.
 *
 * Por que não `node:crypto`: este módulo roda TAMBÉM na webview do Tauri, onde
 * `node:crypto` não existe. Por que não `crypto.subtle`: a API é assíncrona e
 * só funciona em secure context — usá-la contaminaria de `Promise` o builder
 * inteiro (que precisa ser síncrono e determinístico) e criaria a classe de bug
 * "funciona no server, quebra na webview em produção".
 *
 * SHA-1 é exigido por duas coisas da NFC-e e não há escolha de algoritmo:
 * o `cHashQRCode` do QR Code e o `DigestValue` da assinatura XMLDSig.
 */

const encoder = new TextEncoder();

/** Bytes UTF-8 de uma string. */
export function utf8Bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

/** Digest SHA-1 (20 bytes). */
export function sha1(input: string | Uint8Array): Uint8Array {
  const message = typeof input === "string" ? utf8Bytes(input) : input;
  const blocks = pad(message);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  // `w` é reaproveitado entre blocos: alocar 80 inteiros por bloco domina o
  // tempo em mensagens grandes.
  const w = new Int32Array(80);

  for (let offset = 0; offset < blocks.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const at = offset + i * 4;
      w[i] =
        (blocks[at] << 24) |
        (blocks[at + 1] << 16) |
        (blocks[at + 2] << 8) |
        blocks[at + 3];
    }
    for (let i = 16; i < 80; i++)
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const digest = new Uint8Array(20);
  writeInt32BE(digest, 0, h0);
  writeInt32BE(digest, 4, h1);
  writeInt32BE(digest, 8, h2);
  writeInt32BE(digest, 12, h3);
  writeInt32BE(digest, 16, h4);
  return digest;
}

/** Digest em hexadecimal MAIÚSCULO — formato do `cHashQRCode`. */
export function sha1Hex(input: string | Uint8Array): string {
  let out = "";
  for (const byte of sha1(input)) out += byte.toString(16).padStart(2, "0");
  return out.toUpperCase();
}

/** Digest em base64 — formato do `DigestValue` da assinatura XMLDSig. */
export function sha1Base64(input: string | Uint8Array): string {
  return toBase64(sha1(input));
}

/**
 * Base64 sem `Buffer`: `btoa` é global tanto no Node quanto na webview, e
 * `Buffer` não existe no browser.
 */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

/** Padding do SHA-1: 0x80, zeros, e o comprimento em bits (64 bits big-endian). */
function pad(message: Uint8Array): Uint8Array {
  const bitLength = message.length * 8;
  // +1 do byte 0x80, +8 do comprimento; arredonda para múltiplo de 64.
  const total = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(total);
  padded.set(message);
  padded[message.length] = 0x80;
  // Só os 32 bits baixos do comprimento: mensagem de 512MB+ não existe aqui.
  writeInt32BE(padded, total - 8, Math.floor(bitLength / 0x100000000));
  writeInt32BE(padded, total - 4, bitLength | 0);
  return padded;
}

function rotl(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

function writeInt32BE(target: Uint8Array, at: number, value: number): void {
  target[at] = (value >>> 24) & 0xff;
  target[at + 1] = (value >>> 16) & 0xff;
  target[at + 2] = (value >>> 8) & 0xff;
  target[at + 3] = value & 0xff;
}
