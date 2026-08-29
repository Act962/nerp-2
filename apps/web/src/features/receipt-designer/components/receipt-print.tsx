"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { PAPER_MM, PX_PER_MM } from "../lib/paper";
import type { ReceiptBlock, ReceiptPaper, ReceiptSaleData } from "../lib/types";
import { ReceiptRender } from "./receipt-render";

const AREA_ID = "receipt-print-area";
const STYLE_ID = "receipt-print-style";

// Folga em mm depois do último bloco: a guilhotina/serrilha da térmica fica
// alguns milímetros acima da cabeça de impressão, então sem isso a última linha
// sai cortada.
const TAIL_MM = 5;

// O @page precisa de uma ALTURA concreta. `size: 80mm auto` mistura <length>
// com a keyword `auto`, combinação que a spec de Paged Media não aceita: o
// navegador descarta a declaração inteira e a impressão cai no papel padrão do
// driver (A4). Numa bobina contínua isso sai em branco ou puxa papel sem fim.
// Medimos o cupom já renderizado e emitimos a altura exata, que numa bobina
// corta rente ao conteúdo.
function pageHeightMm(fallbackMm: number): number {
  const area = document.getElementById(AREA_ID);
  const px = area?.getBoundingClientRect().height ?? 0;
  if (!px) return fallbackMm;
  return Math.ceil(px / PX_PER_MM) + TAIL_MM;
}

function pageRule(paper: ReceiptPaper): string {
  if (paper === "A4") return "size: A4; margin: 12mm;";
  const { page } = PAPER_MM[paper];
  return `size: ${page}mm ${pageHeightMm(297)}mm; margin: 0;`;
}

// Injeta um @page + regras de visibilidade que isolam SÓ o cupom na impressão,
// dispara o print e limpa depois. Reaproveita o DOM já renderizado do portal.
export function triggerReceiptPrint(paper: ReceiptPaper) {
  document.getElementById(STYLE_ID)?.remove();
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @media print {
      /* O cupom é um portal filho DIRETO do body; escondemos os demais filhos
         com display:none (não visibility) para não sobrar altura fantasma que
         gera páginas em branco no fim. */
      body > *:not(#${AREA_ID}) { display: none !important; }
      #${AREA_ID} {
        position: static !important;
        left: auto !important;
        width: ${PAPER_MM[paper].page}mm !important;
      }
      /* Sem isto o navegador "economiza tinta" e o logo/QR saem lavados ou
         somem na térmica, que só tem preto. */
      #${AREA_ID} * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @page { ${pageRule(paper)} }
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
