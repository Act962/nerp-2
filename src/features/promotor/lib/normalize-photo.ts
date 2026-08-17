// Normaliza a foto recém-capturada para a proporção padrão do book (3:4 vertical
// ou 4:3 horizontal). A câmera nativa do celular já é 4:3, então na prática só
// recorta quem vier fora do padrão (16:9, upload da galeria, etc.). Corta pelo
// centro e reescala para os pixels padrão — assim a foto encaixa 100% no espaço
// do book, sem corte extra nem borda. Roda no client, antes de carimbar a senha.

import { STANDARD_PHOTO_PX, standardOrientation } from "@/lib/photo-standard";

export async function normalizePhotoToStandard(file: File): Promise<File> {
  // `from-image` aplica a orientação EXIF nos pixels (fotos de celular vêm
  // giradas); a saída é um JPEG já "de pé", sem metadado de rotação.
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });

  const orientation = standardOrientation(bitmap.width, bitmap.height);
  const target = STANDARD_PHOTO_PX[orientation];
  const targetAspect = target.width / target.height;
  const sourceAspect = bitmap.width / bitmap.height;

  // Retângulo de recorte centralizado na proporção alvo: se a fonte é mais
  // larga que o alvo, sobra nas laterais; se é mais alta, sobra em cima/baixo.
  let cropWidth = bitmap.width;
  let cropHeight = bitmap.height;
  if (sourceAspect > targetAspect) {
    cropWidth = Math.round(bitmap.height * targetAspect);
  } else {
    cropHeight = Math.round(bitmap.width / targetAspect);
  }
  const cropX = Math.round((bitmap.width - cropWidth) / 2);
  const cropY = Math.round((bitmap.height - cropHeight) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    // Sem canvas 2D não dá pra normalizar — segue com a foto original em vez
    // de perder a captura em campo.
    return file;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    target.width,
    target.height,
  );
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92),
  );
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
}
