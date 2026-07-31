// Composição do carimbo na foto do promotor: desenha a foto, o código de ação
// (posicionado pelo promotor) e as linhas de texto (nome, data, cidade/UF) num
// canvas e devolve um JPEG. Rodar no client, é ele quem sobe pro R2 depois.

export interface CodigoStamp {
  /**
   * CHAVE do objeto no R2 — não a URL pública.
   *
   * Desenhar no canvas exige ler os bytes, e ler do domínio do R2 depende de
   * CORS: sem o cabeçalho, o `fetch` falha e a foto era salva sem o código,
   * em silêncio (o promotor via o código na prévia, que é só um `<img>` e não
   * precisa de CORS, e só descobria depois). Buscando pela chave, passamos
   * pelo proxy `/api/s3/image`, que é mesma origem — o mesmo caminho que o
   * catálogo promocional já usa para compor em canvas.
   */
  key: string;
  // Posição do canto superior-esquerdo e largura, em fração 0..1 do tamanho da foto.
  x: number;
  y: number;
  scale: number;
}

export interface BakeResult {
  blob: Blob;
  /** true quando havia código para carimbar e ele NÃO pôde ser carregado. */
  codigoFaltando: boolean;
}

/** Bytes da imagem do código, sempre por origem própria. */
function codigoSource(key: string): string {
  // Chave já absoluta (legado): usa como está — nesse caso o CORS ainda vale.
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  return `/api/s3/image?key=${encodeURIComponent(key)}`;
}

async function drawSeal(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sealUrl: string,
) {
  try {
    // Image (não createImageBitmap) rasteriza SVG de forma confiável; asset
    // same-origin em /public, então não contamina o canvas.
    const image = new Image();
    image.src = sealUrl;
    await image.decode();

    const sealWidth = canvas.width * 0.24;
    const sealHeight = sealWidth * (image.height / image.width || 0.27);
    const pad = canvas.width * 0.02;
    const boxX = canvas.width - sealWidth - pad * 2;
    const boxY = canvas.height - sealHeight - pad * 2;

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(boxX, boxY, sealWidth + pad * 2, sealHeight + pad * 2);
    ctx.drawImage(image, boxX + pad, boxY + pad, sealWidth, sealHeight);
  } catch {
    // Sem selo: segue sem ele.
  }
}

export async function bakePhoto(opts: {
  file: File;
  textLines: string[];
  codigo: CodigoStamp | null;
  sealUrl?: string;
}): Promise<BakeResult> {
  // `from-image` normaliza a orientação EXIF (fotos de celular vêm giradas).
  const bitmap = await createImageBitmap(opts.file, {
    imageOrientation: "from-image",
  });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  let codigoFaltando = false;
  if (opts.codigo) {
    try {
      // Buscar como blob evita "tainted canvas": desenhar imagem de outra
      // origem direto quebraria o `toBlob` por segurança.
      const response = await fetch(codigoSource(opts.codigo.key));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const codeBitmap = await createImageBitmap(blob);
      const width = opts.codigo.scale * canvas.width;
      const height = width * (codeBitmap.height / codeBitmap.width);
      ctx.drawImage(
        codeBitmap,
        opts.codigo.x * canvas.width,
        opts.codigo.y * canvas.height,
        width,
        height,
      );
      codeBitmap.close?.();
    } catch {
      // Segue salvando (o promotor está em campo e a foto não pode ser
      // perdida), mas AVISA: antes isso era engolido e a foto ia para
      // aprovação sem o código, sem ninguém perceber.
      codigoFaltando = true;
    }
  }

  const fontSize = Math.max(14, Math.round(canvas.width * 0.03));
  const pad = fontSize * 0.4;
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textBaseline = "alphabetic";

  // Linhas empilhadas de baixo pra cima, cada uma numa pílula semitransparente.
  let bottom = canvas.height - pad;
  for (const line of [...opts.textLines].reverse()) {
    if (!line) continue;
    const metrics = ctx.measureText(line);
    const boxWidth = metrics.width + pad * 2;
    const boxHeight = fontSize + pad;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(pad, bottom - boxHeight, boxWidth, boxHeight);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line, pad * 2, bottom - pad * 0.9);
    bottom -= boxHeight + pad * 0.5;
  }

  // Selo de autenticidade Órbita no canto oposto ao texto (inferior direito).
  await drawSeal(ctx, canvas, opts.sealUrl ?? "/orbita-hub.svg");

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Falha ao gerar a imagem")),
      "image/jpeg",
      0.85,
    );
  });

  return { blob, codigoFaltando };
}
