// Impressão digital INVISÍVEL da foto do promotor — calculada no client a partir
// do arquivo CRU (antes de carimbar a senha/data), pois carimbar muda os bytes a
// cada mês e inutilizaria a comparação. Dois sinais:
//   - imageHash: SHA-256 dos bytes do arquivo → pega reenvio idêntico.
//   - perceptualHash: dHash 64-bit → pega a MESMA foto recomprimida/reeditada.
// Nada disso aparece na imagem; só é gravado nos metadados do PdvPhoto.

export interface PhotoFingerprint {
  imageHash: string;
  perceptualHash: string;
}

/** SHA-256 hex dos bytes crus do arquivo. */
export async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * dHash (difference hash) de 64 bits, em hex (16 chars). Reduz a imagem a 9×8
 * em tons de cinza e, para cada linha, marca 1 quando o pixel é mais claro que o
 * vizinho à direita. Robusto a recompressão/escala/pequenos ajustes de brilho —
 * o que um SHA não pega quando o promotor "salva de novo" a mesma foto.
 */
export async function dHash(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const width = 9;
  const height = 8;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close?.();
    return "";
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const { data } = ctx.getImageData(0, 0, width, height);

  const gray = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    // Luminância perceptual (Rec. 601).
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };

  let bits = "";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      bits += gray(x, y) < gray(x + 1, y) ? "1" : "0";
    }
  }

  // 64 bits → 16 chars hex.
  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Calcula os dois hashes do arquivo cru. Best-effort — nunca derruba a captura. */
export async function fingerprintPhoto(file: File): Promise<PhotoFingerprint> {
  const [imageHash, perceptualHash] = await Promise.all([
    sha256(file).catch(() => ""),
    dHash(file).catch(() => ""),
  ]);
  return { imageHash, perceptualHash };
}

/**
 * Distância de Hamming entre dois dHash hex (nº de bits diferentes, 0..64).
 * ≤ ~10 costuma indicar a mesma imagem. Usada no server pra flag de reuso.
 */
export function hammingDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let xor = Number.parseInt(a[i], 16) ^ Number.parseInt(b[i], 16);
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}
