"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { ReceiptBlock, ReceiptPaper, ReceiptSaleData } from "../lib/types";
import { ReceiptRender } from "./receipt-render";

const AREA_ID = "receipt-print-area";

function pageSize(paper: ReceiptPaper): string {
  if (paper === "A4") return "A4";
  if (paper === "MM58") return "58mm auto";
  return "80mm auto";
}

// Injeta um @page + regras de visibilidade que isolam SÓ o cupom na impressão,
// dispara o print e limpa depois. Reaproveita o DOM já renderizado do portal.
export function triggerReceiptPrint(paper: ReceiptPaper) {
  const styleId = "receipt-print-style";
  document.getElementById(styleId)?.remove();
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @media print {
      /* O cupom é um portal filho DIRETO do body; escondemos os demais filhos
         com display:none (não visibility) para não sobrar altura fantasma que
         gera páginas em branco no fim. */
      body > *:not(#${AREA_ID}) { display: none !important; }
      #${AREA_ID} { position: static !important; left: auto !important; }
      @page { size: ${pageSize(paper)}; margin: ${paper === "A4" ? "12mm" : "0"}; }
    }
  `;
  document.head.appendChild(style);
  const cleanup = () => {
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

// Mantém o cupom renderizado (fora da tela) pronto para impressão. Renderiza via
// portal no body para o @media print conseguir isolá-lo do resto da página.
export function ReceiptPrintArea({
  blocks,
  data,
  paper,
}: {
  blocks: ReceiptBlock[];
  data: ReceiptSaleData;
  paper: ReceiptPaper;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      id={AREA_ID}
      style={{ position: "fixed", left: -10000, top: 0 }}
      aria-hidden
    >
      <ReceiptRender blocks={blocks} data={data} paper={paper} />
    </div>,
    document.body,
  );
}
