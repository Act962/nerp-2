"use client";

import { useState, type RefObject } from "react";
import { toast } from "sonner";

type ExportOptions = {
  previewRef: RefObject<HTMLDivElement | null>;
  allPageRefs: RefObject<(HTMLDivElement | null)[]>;
  totalPages: number;
  catalogName: string;
  pageSize: "square" | "story" | "portrait";
  // Monta o layer de exportação (todas as páginas) e espera as imagens; e o
  // desmonta ao terminar — para não manter os previews na memória.
  prepareExport?: () => Promise<void>;
  finishExport?: () => void;
};

// 1×1 PNG REALMENTE transparente — fallback para imagens que falham (404/CORS).
// (O valor antigo era um pixel verde rgba(0,255,0,.5): imagem que não embutia
// virava um quadrado verde no export.)
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";

const CAPTURE_OPTIONS = {
  pixelRatio: 1,
  skipFonts: true,
  imagePlaceholder: TRANSPARENT_PIXEL,
  cacheBust: false,
} as const;

async function captureEl(el: HTMLDivElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  return toPng(el, CAPTURE_OPTIONS);
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

      await prepareExport?.();
      const { zipSync } = await import("fflate");
      const files: Record<string, Uint8Array> = {};
      const pad = String(totalPages).length;

      for (let i = 0; i < totalPages; i++) {
        const el = allPageRefs.current[i];
        if (!el) continue;
        const dataUrl = await captureEl(el);
        const base64 = dataUrl.split(",")[1] ?? "";
        files[`${catalogName}-pagina-${String(i + 1).padStart(pad, "0")}.png`] =
          base64ToBytes(base64);
      }

      const zipped = zipSync(files, { level: 0 });
      const blob = new Blob([zipped as BlobPart], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${catalogName}.zip`);
      URL.revokeObjectURL(url);
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
      await prepareExport?.();
      const { jsPDF } = await import("jspdf");

      const pxToMm = (px: number) => px * 0.264583;
      let pdf: InstanceType<typeof jsPDF> | null = null;

      for (let i = 0; i < totalPages; i++) {
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

        const wMm = pxToMm(img.naturalWidth || img.width);
        const hMm = pxToMm(img.naturalHeight || img.height);
        const orientation = wMm > hMm ? "landscape" : "portrait";

        if (!pdf) {
          pdf = new jsPDF({ orientation, unit: "mm", format: [wMm, hMm] });
        } else {
          pdf.addPage([wMm, hMm], orientation);
        }

        pdf.addImage(dataUrl, "PNG", 0, 0, wMm, hMm);
      }

      if (pdf) {
        pdf.save(`${catalogName}.pdf`);
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
      await prepareExport?.();
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
      await prepareExport?.();
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
      await prepareExport?.();
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
