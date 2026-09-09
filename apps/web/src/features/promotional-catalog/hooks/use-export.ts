"use client";

import { useState, type RefObject } from "react";
import { toast } from "sonner";

type ExportOptions = {
  previewRef: RefObject<HTMLDivElement | null>;
  allPageRefs: RefObject<(HTMLDivElement | null)[]>;
  totalPages: number;
  catalogName: string;
  pageSize: "square" | "story" | "portrait";
  // Monta o layer de exportação e espera as imagens; desmonta ao terminar.
  // Sem argumentos = todas as páginas; com `from`/`to` = só aquele lote, que é
  // como o export de catálogo grande evita montar centenas de páginas juntas.
  prepareExport?: (from?: number, to?: number) => Promise<void>;
  finishExport?: () => void;
  // Preset de qualidade do PDF/PNG. Ausente = "high".
  quality?: ExportQuality;
};

export type ExportQuality = "max" | "high" | "balanced" | "light";

/** Chave do preset escolhido no localStorage. */
export const EXPORT_QUALITY_KEY = "nerp:catalogo:qualidade-export";

/**
 * Presets de exportação.
 *
 * Os tamanhos abaixo são MEDIDOS, não calculados: rasterizei as páginas reais
 * do "CATÁLOGO ARMAZÉM CARVALHO 2026" (222 páginas — capa + 107 com foto de
 * fundo + 114 sem) e medi os bytes de cada codificação.
 *
 * | preset      | largura | DPI | 222 páginas |
 * |-------------|---------|-----|-------------|
 * | (PNG antigo)| 2400    | 213 | ~440 MB, em 9 arquivos |
 * | max         | 2400    | 213 | ~65 MB |
 * | high        | 2160    | 192 | ~42 MB |
 * | balanced    | 1620    | 144 | ~21 MB |
 * | light       | 1296    | 115 | ~11 MB |
 *
 * `minQuality` é o piso do ajuste automático (ver `exportAsPdf`). Abaixo dele o
 * ringing na borda do preço fica visível, então é preferível perder resolução.
 */
export const EXPORT_PRESETS = {
  max: { label: "Máxima", targetWidth: 2400, quality: 0.92, minQuality: 0.84 },
  high: { label: "Alta", targetWidth: 2160, quality: 0.88, minQuality: 0.78 },
  balanced: {
    label: "Equilibrada",
    targetWidth: 1620,
    quality: 0.82,
    minQuality: 0.62,
  },
  light: { label: "Leve", targetWidth: 1296, quality: 0.72, minQuality: 0.58 },
} as const satisfies Record<
  ExportQuality,
  { label: string; targetWidth: number; quality: number; minQuality: number }
>;

// Páginas por lote de DOM: quantas são montadas no layer oculto de uma vez.
// É só memória do DOM — NÃO decide mais o tamanho do arquivo. O PDF hoje sai
// num arquivo só, atravessando todos os lotes (era aqui que nasciam os 9
// arquivos que tornavam o download inútil).
//
// O caminho PNG/zip continua fatiando por lote: são centenas de PNGs sem perda,
// e ali o corte por contagem faz sentido.
const DOM_BATCH = 25;

// Alvo de tamanho do PDF. É um GUARDA-COSTAS, não o mecanismo principal: os
// presets já entregam o tamanho (ver a tabela em EXPORT_PRESETS), e o ajuste
// por página só entra em ação em catálogo mais pesado do que o preset previu.
const PDF_BUDGET_BYTES = 46 * 1024 * 1024;

// Teto DURO de páginas por arquivo — válvula de memória, não de tamanho.
//
// O PDF sai num arquivo só, que é o pedido. Mas o payload das imagens vive uma
// vez dentro do jsPDF e outra na hora do `output()`: num catálogo de 474
// páginas (existem, ver `page-chunks.test.ts`) o pico passaria de meio giga e
// derrubaria a aba. Acima disso, e só acima, o download volta a ser fatiado.
const PDF_MAX_PAGES = 400;

/**
 * DPI que o preset entrega na página impressa.
 *
 * A página do catálogo tem 1080 px de layout, e o PDF a declara em mm pelo
 * mesmo px (285,75 mm = 11,25 pol). Então o DPI é só a largura capturada
 * dividida por essas 11,25 polegadas.
 */
export function presetDpi(quality: ExportQuality): number {
  return Math.round(EXPORT_PRESETS[quality].targetWidth / 11.25);
}

export function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Rótulo do lote no nome do arquivo: "001-025".
function batchLabel(from: number, to: number, pad: number): string {
  return `${String(from + 1).padStart(pad, "0")}-${String(to).padStart(pad, "0")}`;
}

// 1×1 PNG REALMENTE transparente — fallback para imagens que falham (404/CORS).
// (O valor antigo era um pixel verde rgba(0,255,0,.5): imagem que não embutia
// virava um quadrado verde no export.)
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";

const CAPTURE_OPTIONS = {
  skipFonts: true,
  imagePlaceholder: TRANSPARENT_PIXEL,
  cacheBust: false,
} as const;

// O `pixelRatio` é DINÂMICO: mira uma largura de saída independentemente do
// tamanho do nó na tela, então etiqueta pequena também sai nítida. Limitado a
// 4 pra não estourar o canvas (navegadores travam perto de ~16k px de lado).
//
// NÃO existe piso: havia um `MIN_PIXEL_RATIO = 2` que anulava qualquer preset
// abaixo de 2160 px — `max(2, 1620/1080)` é 2, então "Equilibrada" saía com o
// tamanho de "Alta".
const MAX_PIXEL_RATIO = 4;

export function pixelRatioFor(
  el: Pick<HTMLElement, "offsetWidth" | "clientWidth">,
  quality: ExportQuality,
): number {
  const width = el.offsetWidth || el.clientWidth || 1080;
  return Math.min(MAX_PIXEL_RATIO, EXPORT_PRESETS[quality].targetWidth / width);
}

// Rasteriza para um canvas em vez de direto para data URL: reencodar do canvas
// custa ~100 ms, refazer DOM→raster custa segundos — é o que torna viável o
// ajuste de qualidade por página em `exportAsPdf`.
//
// `backgroundColor` branco é OBRIGATÓRIO aqui: JPEG não tem alfa, e o catálogo
// tem transparência real (opacidade do fundo, "remover fundo da imagem"). Sem
// isso a página sai PRETA.
async function captureCanvas(
  el: HTMLDivElement,
  pixelRatio: number,
): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import("html-to-image");
  return toCanvas(el, {
    ...CAPTURE_OPTIONS,
    backgroundColor: "#ffffff",
    pixelRatio,
  });
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL("image/jpeg", quality);
}

/** Devolve a memória do canvas imediatamente, sem esperar o GC. */
function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Cria os links clicáveis da página de ÍNDICE no PDF.
 *
 * O render marca cada número com `data-index-target="<página>"`; aqui os
 * retângulos viram anotações `/Dest` internas do PDF (`pdf.link` com
 * `pageNumber`), que é o que faz o leitor pular ao clicar. Mudar aquele
 * atributo no render quebra isto em silêncio — o índice continua bonito e para
 * de navegar.
 *
 * Precisa ser chamado logo depois do `addImage` da página, porque o jsPDF
 * prende a anotação na página CORRENTE.
 *
 * `offset`/`count` recortam o arquivo: quando o catálogo estoura o teto de
 * páginas e é fatiado, o destino é o número DENTRO do arquivo — e um alvo que
 * caiu no arquivo seguinte simplesmente não vira link, em vez de virar um link
 * para a página errada.
 */
function addIndexLinks(
  pdf: {
    link: (x: number, y: number, w: number, h: number, o: unknown) => void;
  },
  el: HTMLElement,
  pxToMm: (px: number) => number,
  offset: number,
  count: number,
) {
  const alvos = el.querySelectorAll<HTMLElement>("[data-index-target]");
  if (alvos.length === 0) return;

  const base = el.getBoundingClientRect();
  // O nó pode estar dentro de um wrapper escalado; sem desfazer a escala os
  // retângulos sairiam menores que os números.
  const escala = el.offsetWidth > 0 ? base.width / el.offsetWidth : 1;
  if (!Number.isFinite(escala) || escala <= 0) return;

  for (const alvo of alvos) {
    const numero = Number(alvo.dataset.indexTarget) - offset;
    if (!Number.isFinite(numero) || numero < 1 || numero > count) continue;
    const r = alvo.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Folga de 3 px: número tem uns 20 px de largura, e mirar nele sem sobra
    // exige precisão de pixel.
    const folga = 3;
    pdf.link(
      pxToMm((r.left - base.left) / escala - folga),
      pxToMm((r.top - base.top) / escala - folga),
      pxToMm(r.width / escala + folga * 2),
      pxToMm(r.height / escala + folga * 2),
      { pageNumber: numero },
    );
  }
}

/** Bytes reais de um data URL base64 (4 caracteres = 3 bytes). */
function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.round(base64.length * 0.75);
}

// Caminho PNG (imagem solta e zip): segue SEM PERDA e com alfa, de propósito —
// quem baixa PNG quer a imagem para reusar, não para folhear.
async function captureEl(
  el: HTMLDivElement,
  quality: ExportQuality,
): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(el, {
    ...CAPTURE_OPTIONS,
    pixelRatio: pixelRatioFor(el, quality),
  });
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  link.click();
}

// Converte o base64 de um data URL em bytes para empacotar no zip.
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function useExport({
  previewRef,
  allPageRefs,
  totalPages,
  catalogName,
  pageSize: _pageSize,
  prepareExport,
  finishExport,
  quality = "high",
}: ExportOptions) {
  const [isExporting, setIsExporting] = useState(false);

  // 1 página → baixa .png; várias páginas → baixa um .zip com um .png por página.
  async function exportAsPng() {
    setIsExporting(true);
    try {
      if (totalPages <= 1) {
        if (!previewRef.current) return;
        const dataUrl = await captureEl(previewRef.current, quality);
        triggerDownload(dataUrl, `${catalogName}.png`);
        return;
      }

      const { zipSync } = await import("fflate");
      const pad = String(totalPages).length;
      const emLotes = totalPages > DOM_BATCH;

      for (let from = 0; from < totalPages; from += DOM_BATCH) {
        const to = Math.min(from + DOM_BATCH, totalPages);
        await prepareExport?.(from, to);

        const files: Record<string, Uint8Array> = {};
        for (let i = from; i < to; i++) {
          const el = allPageRefs.current[i];
          if (!el) continue;
          const dataUrl = await captureEl(el, quality);
          const base64 = dataUrl.split(",")[1] ?? "";
          files[
            `${catalogName}-pagina-${String(i + 1).padStart(pad, "0")}.png`
          ] = base64ToBytes(base64);
        }

        const zipped = zipSync(files, { level: 0 });
        const blob = new Blob([zipped as BlobPart], {
          type: "application/zip",
        });
        const url = URL.createObjectURL(blob);
        triggerDownload(
          url,
          emLotes
            ? `${catalogName}-paginas-${batchLabel(from, to, pad)}.zip`
            : `${catalogName}.zip`,
        );
        URL.revokeObjectURL(url);

        // Desmonta o lote ANTES de montar o próximo — é o que mantém o pico de
        // memória no tamanho de um lote em vez do catálogo inteiro.
        finishExport?.();
        if (emLotes) toast.info(`Exportando ${to}/${totalPages} páginas…`);
      }
    } catch (err) {
      console.error("Erro ao exportar PNG:", err);
      toast.error("Erro ao gerar PNG. Tente novamente.");
    } finally {
      finishExport?.();
      setIsExporting(false);
    }
  }

  async function exportAsPdf() {
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const preset = EXPORT_PRESETS[quality];
      const pxToMm = (px: number) => px * 0.264583;

      // UM arquivo, atravessando todos os lotes de DOM. Antes era um PDF por
      // lote de 25 páginas — 222 páginas viravam 9 arquivos, que é o que
      // tornava o download inútil.
      let pdf: InstanceType<typeof jsPDF> | null = null;
      // Guarda-costas de tamanho: com os presets medidos nenhum catálogo
      // conhecido encosta aqui, mas um com foto de fundo em TODAS as páginas
      // encostaria. `q` persiste entre páginas e converge em poucas.
      let gasto = 0;
      let feitas = 0;
      let q: number = preset.quality;
      // Recorte do arquivo corrente: onde ele começa (0-based) e quantas
      // páginas já tem. Só passa de um arquivo acima de PDF_MAX_PAGES.
      let arquivoDe = 0;
      let paginasNoArquivo = 0;
      const pad = String(totalPages).length;
      const fatiado = totalPages > PDF_MAX_PAGES;

      const salvarArquivo = (
        doc: InstanceType<typeof jsPDF>,
        de: number,
        ate: number,
      ) => {
        // `output("blob")` + revoke em vez de `save()`: com dezenas de MB,
        // deixar o blob pendurado na aba é desperdício de memória.
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        triggerDownload(
          url,
          fatiado
            ? `${catalogName}-${batchLabel(de, ate, pad)}.pdf`
            : `${catalogName}.pdf`,
        );
        URL.revokeObjectURL(url);
        return blob.size;
      };

      for (let from = 0; from < totalPages; from += DOM_BATCH) {
        const to = Math.min(from + DOM_BATCH, totalPages);
        await prepareExport?.(from, to);

        for (let i = from; i < to; i++) {
          const el = allPageRefs.current[i];
          if (!el) continue;

          const canvas = await captureCanvas(el, pixelRatioFor(el, quality));

          const restante = Math.max(1, totalPages - feitas);
          const cota = (PDF_BUDGET_BYTES - gasto) / restante;
          let dataUrl = encodeJpeg(canvas, q);
          let bytes = dataUrlBytes(dataUrl);

          // UMA re-tentativa por página: mais que isso não paga o tempo.
          if (bytes > cota * 1.35 && q > preset.minQuality) {
            q = Math.max(preset.minQuality, q - 0.06);
            dataUrl = encodeJpeg(canvas, q);
            bytes = dataUrlBytes(dataUrl);
          } else if (bytes < cota * 0.6 && q < preset.quality) {
            // Sobrou orçamento: devolve qualidade em vez de guardar folga.
            q = Math.min(preset.quality, q + 0.04);
          }
          gasto += bytes;
          feitas++;
          releaseCanvas(canvas);

          // Tamanho FÍSICO pelo px de layout, não pela captura (que vem
          // multiplicada pelo pixelRatio): a página mantém o tamanho e a
          // imagem de alta-res enche em DPI maior.
          const wMm = pxToMm(el.offsetWidth);
          const hMm = pxToMm(el.offsetHeight);
          const orientation = wMm > hMm ? "landscape" : "portrait";

          if (!pdf) {
            pdf = new jsPDF({
              orientation,
              unit: "mm",
              format: [wMm, hMm],
              compress: true,
            });
          } else {
            pdf.addPage([wMm, hMm], orientation);
          }

          // "JPEG" e não "PNG": o jsPDF embute JPEG verbatim (DCTDecode),
          // enquanto PNG ele DECODIFICA e re-comprime em JS puro, com deflate
          // pior que o do navegador — e ainda gera um SMask por causa do alfa.
          pdf.addImage(dataUrl, "JPEG", 0, 0, wMm, hMm);
          paginasNoArquivo++;
          addIndexLinks(
            pdf,
            el,
            pxToMm,
            arquivoDe,
            Math.min(PDF_MAX_PAGES, totalPages - arquivoDe),
          );

          if (paginasNoArquivo >= PDF_MAX_PAGES && i + 1 < totalPages) {
            salvarArquivo(pdf, arquivoDe, i + 1);
            pdf = null;
            arquivoDe = i + 1;
            paginasNoArquivo = 0;
          }
        }

        // Desmonta o lote ANTES de montar o próximo: é o que segura o pico de
        // memória do DOM. O `pdf` sobrevive.
        finishExport?.();
        if (totalPages > DOM_BATCH)
          toast.info(`Exportando ${to}/${totalPages} páginas…`);
      }

      if (pdf) {
        const tamanho = salvarArquivo(pdf, arquivoDe, totalPages);
        toast.success(
          fatiado
            ? `PDF gerado em partes: ${totalPages} páginas no total.`
            : `PDF gerado: ${totalPages} páginas, ${formatMB(tamanho)}.`,
        );
      }
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      finishExport?.();
      setIsExporting(false);
    }
  }

  // Baixa APENAS a página `pageIndex` (a selecionada) como .png.
  async function exportPageAsPng(pageIndex: number) {
    setIsExporting(true);
    try {
      // Só a página pedida — montar o catálogo inteiro para capturar uma
      // página é desperdício, e inviável num catálogo grande.
      await prepareExport?.(pageIndex, pageIndex + 1);
      const el = allPageRefs.current[pageIndex];
      if (!el) {
        toast.error("Página não encontrada.");
        return;
      }
      const dataUrl = await captureEl(el, quality);
      triggerDownload(dataUrl, `${catalogName}-pagina-${pageIndex + 1}.png`);
    } catch (err) {
      console.error("Erro ao exportar PNG da página:", err);
      toast.error("Erro ao gerar PNG. Tente novamente.");
    } finally {
      finishExport?.();
      setIsExporting(false);
    }
  }

  // Imprime a página `pageIndex`: gera um PDF de UMA página com o tamanho da
  // própria página (`format: [wMm, hMm]`, sem margem) e a imagem preenchendo-a
  // por inteiro — o jsPDF faz o AJUSTE DE TAMANHO DE PÁGINA mantendo a PROPORÇÃO
  // dos elementos. Abre o diálogo de impressão do navegador via `autoPrint()`.
  async function printPage(pageIndex: number) {
    setIsExporting(true);
    try {
      // Só a página pedida — montar o catálogo inteiro para capturar uma
      // página é desperdício, e inviável num catálogo grande.
      await prepareExport?.(pageIndex, pageIndex + 1);
      const el = allPageRefs.current[pageIndex];
      if (!el) {
        toast.error("Página não encontrada.");
        return;
      }
      const { jsPDF } = await import("jspdf");
      const preset = EXPORT_PRESETS[quality];
      const pxToMm = (px: number) => px * 0.264583;
      const canvas = await captureCanvas(el, pixelRatioFor(el, quality));
      const dataUrl = encodeJpeg(canvas, preset.quality);
      releaseCanvas(canvas);
      // Tamanho pelo px de LAYOUT, igual ao PDF do catálogo inteiro. Usar
      // `naturalWidth` (a captura, já multiplicada pelo pixelRatio) fazia esta
      // página sair com 635 mm de largura — 2,2× maior que as 285,75 mm das
      // outras, e a ~96 DPI em vez de 213.
      const wMm = pxToMm(el.offsetWidth);
      const hMm = pxToMm(el.offsetHeight);
      const orientation = wMm > hMm ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [wMm, hMm],
        compress: true,
      });
      pdf.addImage(dataUrl, "JPEG", 0, 0, wMm, hMm);
      pdf.autoPrint();
      // iframe OCULTO (sem pop-up, sem bloqueador): carrega o PDF já com
      // `autoPrint` e dispara o diálogo de impressão do navegador.
      const blobUrl = pdf.output("bloburl");
      const iframe = document.createElement("iframe");
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      iframe.src = String(blobUrl);
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          // autoPrint no próprio PDF cobre o caso de print() ser bloqueado.
        }
        window.setTimeout(() => iframe.remove(), 60_000);
      };
      document.body.appendChild(iframe);
    } catch (err) {
      console.error("Erro ao imprimir a página:", err);
      toast.error("Erro ao preparar a impressão. Tente novamente.");
    } finally {
      finishExport?.();
      setIsExporting(false);
    }
  }

  // Baixa APENAS a página `pageIndex` (a selecionada) como .pdf.
  async function exportPageAsPdf(pageIndex: number) {
    setIsExporting(true);
    try {
      // Só a página pedida — montar o catálogo inteiro para capturar uma
      // página é desperdício, e inviável num catálogo grande.
      await prepareExport?.(pageIndex, pageIndex + 1);
      const el = allPageRefs.current[pageIndex];
      if (!el) {
        toast.error("Página não encontrada.");
        return;
      }
      const { jsPDF } = await import("jspdf");
      const preset = EXPORT_PRESETS[quality];
      const pxToMm = (px: number) => px * 0.264583;
      const canvas = await captureCanvas(el, pixelRatioFor(el, quality));
      const dataUrl = encodeJpeg(canvas, preset.quality);
      releaseCanvas(canvas);
      // Tamanho pelo px de LAYOUT, igual ao PDF do catálogo inteiro. Usar
      // `naturalWidth` (a captura, já multiplicada pelo pixelRatio) fazia esta
      // página sair com 635 mm de largura — 2,2× maior que as 285,75 mm das
      // outras, e a ~96 DPI em vez de 213.
      const wMm = pxToMm(el.offsetWidth);
      const hMm = pxToMm(el.offsetHeight);
      const orientation = wMm > hMm ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [wMm, hMm],
        compress: true,
      });
      pdf.addImage(dataUrl, "JPEG", 0, 0, wMm, hMm);
      pdf.save(`${catalogName}-pagina-${pageIndex + 1}.pdf`);
    } catch (err) {
      console.error("Erro ao exportar PDF da página:", err);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      finishExport?.();
      setIsExporting(false);
    }
  }

  /**
   * Tamanho provável do PDF, medido por amostragem — para a tela mostrar um
   * número antes de o usuário esperar minutos por um download.
   *
   * Amostra 3 páginas porque elas variam MUITO: no catálogo que motivou isso,
   * página com foto de fundo pesa ~315 KB e sem fundo ~73 KB no mesmo preset.
   * Daí o rótulo ter que dizer "estimativa" — o erro é da ordem de ±25%.
   */
  async function estimatePdfBytes(): Promise<number> {
    const preset = EXPORT_PRESETS[quality];
    const amostra = [
      ...new Set([0, Math.floor(totalPages / 2), totalPages - 1]),
    ].filter((i) => i >= 0 && i < totalPages);

    let soma = 0;
    let n = 0;
    try {
      for (const i of amostra) {
        await prepareExport?.(i, i + 1);
        const el = allPageRefs.current[i];
        if (el) {
          const canvas = await captureCanvas(el, pixelRatioFor(el, quality));
          soma += dataUrlBytes(encodeJpeg(canvas, preset.quality));
          releaseCanvas(canvas);
          n++;
        }
        finishExport?.();
      }
    } finally {
      finishExport?.();
    }
    // 1,08 = estrutura do PDF por cima dos bytes de imagem.
    return n === 0 ? 0 : Math.round((soma / n) * totalPages * 1.08);
  }

  return {
    exportAsPng,
    exportAsPdf,
    estimatePdfBytes,
    exportPageAsPng,
    exportPageAsPdf,
    printPage,
    isExporting,
  };
}
