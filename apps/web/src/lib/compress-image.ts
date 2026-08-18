// Reduz foto de celular antes do upload. O destino final é o PDF do book, que
// é 960x540pt — uma foto de 12MP subiria ~30x maior do que o necessário, e o
// promotor está em 4G dentro do supermercado.
//
// Saída em WebP: no mesmo tamanho de tela ele é ~30% menor que JPEG sem perda
// visível, então o storage enche mais devagar sem virar etapa nem pesar na
// qualidade. Navegador antigo sem encode WebP no canvas cai pro JPEG.

interface CompressOptions {
  maxEdge?: number;
  quality?: number;
}

// Abaixo disso não compensa re-encodar: JPEG já comprimido só perde qualidade.
const MIN_BYTES_TO_COMPRESS = 500_000;

/** Codifica o canvas, preferindo WebP; se o navegador não souber, usa JPEG. */
async function encode(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<{ blob: Blob; type: "image/webp" | "image/jpeg" } | null> {
  const webp = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
  // Alguns navegadores devolvem PNG (ignorando o tipo pedido) quando não têm
  // encoder WebP; nesse caso o `blob.type` não é image/webp — então caímos
  // explicitamente pro JPEG em vez de subir um PNG gigante.
  if (webp && webp.type === "image/webp")
    return { blob: webp, type: "image/webp" };

  const jpeg = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (jpeg) return { blob: jpeg, type: "image/jpeg" };
  return null;
}

export async function compressImage(
  file: File,
  { maxEdge = 1600, quality = 0.8 }: CompressOptions = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size < MIN_BYTES_TO_COMPRESS) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const largestEdge = Math.max(bitmap.width, bitmap.height);
    // Nunca faz upscale — foto pequena sai no tamanho original.
    const scale = Math.min(1, maxEdge / largestEdge);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const encoded = await encode(canvas, quality);
    if (!encoded || encoded.blob.size >= file.size) return file;

    const extension = encoded.type === "image/webp" ? ".webp" : ".jpg";
    return new File([encoded.blob], file.name.replace(/\.\w+$/, extension), {
      type: encoded.type,
      lastModified: file.lastModified,
    });
  } catch {
    // HEIC do iPhone é o caso concreto: createImageBitmap rejeita e o upload
    // não pode morrer junto. Sobe o original e deixa o limite do servidor decidir.
    return file;
  }
}
