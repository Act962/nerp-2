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
};

// Páginas por lote de exportação. Cada lote é montado, capturado, desmontado —
// e vira UM arquivo. Dois limites justificam isso: a memória do DOM ao montar
// as páginas, e o tamanho do arquivo final (cada página vira um PNG de ~2400px
// de largura, então um catálogo de centenas de páginas passaria de 1 GB num
// zip/PDF só).
//
// Catálogo com até EXPORT_BATCH páginas segue pelo caminho antigo: um arquivo,
// mesmo nome de sempre.
const EXPORT_BATCH = 25;

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

// Alta resolução na exportação: o `pixelRatio` fixo em 1 rasterizava a captura
// no tamanho de TELA do nó — por isso a qualidade dependia do tamanho da
// etiqueta/grupo (aumentar o nó "melhorava"). Aqui o pixelRatio é DINÂMICO:
// mira uma largura de saída alta independentemente do tamanho na tela, então
// etiquetas pequenas também saem nítidas. Limitado pra não estourar o canvas
// (navegadores travam perto de ~16k px de lado / muita memória).
const EXPORT_TARGET_WIDTH = 2400; // px do lado capturado (≈ boa qualidade de impressão)
const MIN_PIXEL_RATIO = 2;
const MAX_PIXEL_RATIO = 4;

function pixelRatioFor(el: HTMLElement): number {
  const width = el.offsetWidth || el.clientWidth || EXPORT_TARGET_WIDTH;
  return Math.min(
    MAX_PIXEL_RATIO,
    Math.max(MIN_PIXEL_RATIO, EXPORT_TARGET_WIDTH / width),
  );
}

async function captureEl(el: HTMLDivElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(el, { ...CAPTURE_OPTIONS, pixelRatio: pixelRatioFor(el) });
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
}: ExportOptions) {
  const [isExporting, setIsExporting] = useState(false);

  // 1 página → baixa .png; várias páginas → baixa um .zip com um .png por página.
  async function exportAsPng() {
    setIsExporting(true);
    try {
      if (totalPages <= 1) {
        if (!previewRef.current) return;
        const dataUrl = await captureEl(previewRef.current);
        triggerDownload(dataUrl, `${catalogName}.png`);
        return;
      }

      const { zipSync } = await import("fflate");
      const pad = String(totalPages).length;
      const emLotes = totalPages > EXPORT_BATCH;

      for (let from = 0; from < totalPages; from += EXPORT_BATCH) {
        const to = Math.min(from + EXPORT_BATCH, totalPages);
        await prepareExport?.(from, to);

        const files: Record<string, Uint8Array> = {};
        for (let i = from; i < to; i++) {
          const el = allPageRefs.current[i];
          if (!el) continue;
          const dataUrl = await captureEl(el);
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
      const pxToMm = (px: number) => px * 0.264583;
      const pad = String(totalPages).length;
      const emLotes = totalPages > EXPORT_BATCH;

      for (let from = 0; from < totalPages; from += EXPORT_BATCH) {
        const to = Math.min(from + EXPORT_BATCH, totalPages);
        await prepareExport?.(from, to);

        // Um PDF POR LOTE: além da memória do DOM, um único PDF com centenas de
        // páginas em ~2400px passaria de 1 GB dentro da aba.
        let pdf: InstanceType<typeof jsPDF> | null = null;

        for (let i = from; i < to; i++) {
          const el = allPageRefs.current[i];
          if (!el) continue;

          const dataUrl = await captureEl(el);

          const img = new Image();
          img.src = dataUrl;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () =>
              reject(new Error(`Falha ao carregar página ${i + 1}`));
          });

          // Tamanho FÍSICO pelo px de layout (offsetWidth), não pela captura
          // (que agora vem multiplicada pelo pixelRatio). Mantém a página do
          // mesmo tamanho, com a imagem de alta-res enchendo em DPI maior.
          const wMm = pxToMm(el.offsetWidth || img.naturalWidth || img.width);
          const hMm = pxToMm(
            el.offsetHeight || img.naturalHeight || img.height,
          );
          const orientation = wMm > hMm ? "landscape" : "portrait";

          if (!pdf) {
            pdf = new jsPDF({ orientation, unit: "mm", format: [wMm, hMm] });
          } else {
            pdf.addPage([wMm, hMm], orientation);
          }

          pdf.addImage(dataUrl, "PNG", 0, 0, wMm, hMm);
        }

        if (pdf) {
          pdf.save(
            emLotes
              ? `${catalogName}-${batchLabel(from, to, pad)}.pdf`
              : `${catalogName}.pdf`,
          );
        }

        finishExport?.();
        if (emLotes) toast.info(`Exportando ${to}/${totalPages} páginas…`);
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
      const dataUrl = await captureEl(el);
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
      const pxToMm = (px: number) => px * 0.264583;
      const dataUrl = await captureEl(el);
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao carregar a página"));
      });
      const wMm = pxToMm(img.naturalWidth || img.width);
      const hMm = pxToMm(img.naturalHeight || img.height);
      const orientation = wMm > hMm ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "mm", format: [wMm, hMm] });
      pdf.addImage(dataUrl, "PNG", 0, 0, wMm, hMm);
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
      const pxToMm = (px: number) => px * 0.264583;
      const dataUrl = await captureEl(el);
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao carregar a página"));
      });
      const wMm = pxToMm(img.naturalWidth || img.width);
      const hMm = pxToMm(img.naturalHeight || img.height);
      const orientation = wMm > hMm ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "mm", format: [wMm, hMm] });
      pdf.addImage(dataUrl, "PNG", 0, 0, wMm, hMm);
      pdf.save(`${catalogName}-pagina-${pageIndex + 1}.pdf`);
    } catch (err) {
      console.error("Erro ao exportar PDF da página:", err);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      finishExport?.();
      setIsExporting(false);
    }
  }

  return {
    exportAsPng,
    exportAsPdf,
    exportPageAsPng,
    exportPageAsPdf,
    printPage,
    isExporting,
  };
}
