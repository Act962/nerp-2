// Reduz a foto no cliente antes de mandar pra IA: menos tokens (custo) e
// payload menor. Máx. 768px no maior lado, JPEG qualidade 0.7.
export async function downscaleImage(
  file: File,
  maxDim = 768,
  quality = 0.7,
): Promise<{ base64: string; mimeType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mimeType: "image/jpeg" };
}
