"use client";

import { useState, type RefObject } from "react";
import { toast } from "sonner";

type ExportOptions = {
  previewRef: RefObject<HTMLDivElement | null>;
  allPageRefs: RefObject<(HTMLDivElement | null)[]>;
  totalPages: number;
  catalogName: string;
  pageSize: "square" | "story";
};

// 1×1 transparent PNG — fallback para imagens que retornam 404 ou têm erro de CORS
const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

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

export function useExport({
  previewRef,
  allPageRefs,
  totalPages,
  catalogName,
  pageSize: _pageSize,
}: ExportOptions) {
  const [isExporting, setIsExporting] = useState(false);

  async function exportAsPng() {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await captureEl(previewRef.current);
      const link = document.createElement("a");
      link.download = `${catalogName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erro ao exportar PNG:", err);
      toast.error("Erro ao gerar PNG. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  }

  async function exportAsPdf() {
    setIsExporting(true);
    try {
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
          img.onerror = () => reject(new Error(`Falha ao carregar página ${i + 1}`));
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
      setIsExporting(false);
    }
  }

  return { exportAsPng, exportAsPdf, isExporting };
}
