// Composição do carimbo na foto do promotor: desenha a foto, a senha do mês
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

/** Bytes da imagem da senha do mês, sempre por origem própria. */
export function codigoSource(key: string): string {
  // Chave já absoluta (legado): usa como está — nesse caso o CORS ainda vale.
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  return `/api/s3/image?key=${encodeURIComponent(key)}`;
}

/** Largura da logo TradeGram como fração da largura da foto. */
export const BRAND_WIDTH_RATIO = 0.198;
export const BRAND_PAD_RATIO = 0.02;
/** Altura/largura da arte da logo (SVG 300x90). */
export const BRAND_ASPECT = 0.3;

/** Rodapé de texto: as proporções que o `bakePhoto` usa, para a prévia e o
 * limite de arraste medirem a mesma coisa. */
export const FOOTER_FONT_RATIO = 0.03;

/** Opacidade do quadrado branco sob o selo da indústria. */
export const SEAL_BOX_ALPHA = 0.3;

/** Altura total do bloco de rodapé, em px de canvas. */
export function footerHeightPx(canvasWidth: number, lineCount: number): number {
  const fontSize = Math.max(14, Math.round(canvasWidth * FOOTER_FONT_RATIO));
  const pad = fontSize * 0.4;
  return lineCount * (fontSize + pad + pad * 0.5) + pad;
}

/**
 * Assinatura TradeGram no canto superior direito, sem tarja atrás.
 *
 * Sem retângulo a logo depende do próprio contraste; é o custo de não tapar
 * pedaço da gôndola, que é o conteúdo pelo qual a foto existe.
 */
async function drawBrand(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  brandUrl: string,
) {
  try {
    // Image (não createImageBitmap) rasteriza SVG de forma confiável; asset
    // same-origin em /public, então não contamina o canvas.
    const image = new Image();
    image.src = brandUrl;
    await image.decode();

    const width = canvas.width * BRAND_WIDTH_RATIO;
    const height = width * (image.height / image.width || BRAND_ASPECT);
    const pad = canvas.width * BRAND_PAD_RATIO;

    ctx.drawImage(image, canvas.width - width - pad, pad, width, height);
  } catch {
    // Sem logo: a foto não pode ser perdida por causa da assinatura.
  }
}

/**
 * Aplica o selo numa foto JÁ carimbada (rodapé e logo gravados na captura).
 *
 * É o caminho da coordenadora em /books quando o celular do promotor não
 * conseguiu carregar o selo da indústria: em vez de reprovar e mandar refazer
 * a visita, ela completa a foto. Só o selo é desenhado — redesenhar o rodapé
 * duplicaria as tarjas que já estão na imagem.
 */
export async function applySealToPhoto(opts: {
  photoKey: string;
  codigoKey: string;
  /** Fração 0..1 da largura/altura; padrão no canto superior esquerdo, livre
   * tanto do rodapé quanto da logo. */
  x?: number;
  y?: number;
  scale?: number;
}): Promise<Blob> {
  const [photoResponse, codeResponse] = await Promise.all([
    fetch(codigoSource(opts.photoKey)),
    fetch(codigoSource(opts.codigoKey)),
  ]);
  if (!photoResponse.ok) throw new Error("Não foi possível carregar a foto");
  if (!codeResponse.ok) throw new Error("Não foi possível carregar o selo");

  const photoBitmap = await createImageBitmap(await photoResponse.blob());
  const canvas = document.createElement("canvas");
  canvas.width = photoBitmap.width;
  canvas.height = photoBitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");
  ctx.drawImage(photoBitmap, 0, 0);
  photoBitmap.close?.();

  const codeBitmap = await createImageBitmap(await codeResponse.blob());
  const side = (opts.scale ?? 0.3) * canvas.width;
  const boxX = (opts.x ?? 0.04) * canvas.width;
  const boxY = (opts.y ?? 0.04) * canvas.height;

  ctx.fillStyle = `rgba(255,255,255,${SEAL_BOX_ALPHA})`;
  ctx.fillRect(boxX, boxY, side, side);

  const ratio = codeBitmap.width / codeBitmap.height;
  const width = ratio >= 1 ? side : side * ratio;
  const height = ratio >= 1 ? side / ratio : side;
  ctx.drawImage(
    codeBitmap,
    boxX + (side - width) / 2,
    boxY + (side - height) / 2,
    width,
    height,
  );
  codeBitmap.close?.();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Falha ao gerar a imagem")),
      "image/jpeg",
      0.85,
    );
  });
}

export async function bakePhoto(opts: {
  file: File;
  textLines: string[];
  codigo: CodigoStamp | null;
  brandUrl?: string;
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

  const fontSize = Math.max(14, Math.round(canvas.width * FOOTER_FONT_RATIO));
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

  // Assinatura TradeGram no canto superior direito.
  await drawBrand(ctx, canvas, opts.brandUrl ?? "/tradegram-logo-dark.svg");

  // O CÓDIGO VAI POR ÚLTIMO, por cima de tudo.
  //
  // Antes era desenhado logo depois da foto, e então o texto (rodapé
  // esquerdo) e o selo (rodapé direito) passavam por cima. Quando o promotor
  // posicionava o código embaixo — o lugar natural, já que a gôndola ocupa o
  // meio da foto — as tarjas cobriam justamente o código que a indústria
  // precisa conferir. O código é o motivo da foto existir: nada o encobre.
  let codigoFaltando = false;
  if (opts.codigo) {
    try {
      // Buscar como blob evita "tainted canvas": desenhar imagem de outra
      // origem direto quebraria o `toBlob` por segurança.
      const response = await fetch(codigoSource(opts.codigo.key));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const codeBitmap = await createImageBitmap(blob);

      const side = opts.codigo.scale * canvas.width;
      const boxX = opts.codigo.x * canvas.width;
      const boxY = opts.codigo.y * canvas.height;

      // Quadrado branco 1:1 translúcido. A foto atravessa o selo de propósito:
      // recortado e colado em outra imagem, o fundo denuncia a origem — é o
      // que impede o promotor de reaproveitar o selo num editor externo.
      ctx.fillStyle = `rgba(255,255,255,${SEAL_BOX_ALPHA})`;
      ctx.fillRect(boxX, boxY, side, side);

      // A arte entra CONTIDA no quadrado (nunca esticada), centralizada.
      const ratio = codeBitmap.width / codeBitmap.height;
      const width = ratio >= 1 ? side : side * ratio;
      const height = ratio >= 1 ? side / ratio : side;
      ctx.drawImage(
        codeBitmap,
        boxX + (side - width) / 2,
        boxY + (side - height) / 2,
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
