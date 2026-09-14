"use client";

import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";
import { useEffect, useState } from "react";

type Mesa = {
  id: string;
  number: number;
  name: string | null;
  qrToken: string;
};

const ID_DA_FOLHA = "folha-de-qrs-das-mesas";

/**
 * Folha A4 com um QR por mesa, para recortar e colar.
 *
 * A impressão isola a folha do resto da página pelo mesmo caminho que o cupom
 * já usa: esconder os irmãos com `display:none` (não `visibility`), senão sobra
 * altura fantasma e saem páginas em branco no fim.
 */
export function FolhaDeQrs({ mesas }: { mesas: Mesa[] }) {
  const [origem, setOrigem] = useState("");

  // `window.location` só existe no cliente; o QR precisa do endereço absoluto
  // porque quem lê é a câmera de um celular qualquer.
  useEffect(() => setOrigem(window.location.origin), []);

  const imprimir = () => {
    document.getElementById("estilo-folha-qrs")?.remove();
    const estilo = document.createElement("style");
    estilo.id = "estilo-folha-qrs";
    estilo.textContent = `
      @media print {
        body > *:not(#${ID_DA_FOLHA}) { display: none !important; }
        #${ID_DA_FOLHA} {
          position: static !important;
          left: auto !important;
          width: 100% !important;
        }
        #${ID_DA_FOLHA} * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        @page { size: A4; margin: 12mm; }
      }
    `;
    document.head.appendChild(estilo);
    const limpar = () => {
      estilo.remove();
      window.removeEventListener("afterprint", limpar);
    };
    window.addEventListener("afterprint", limpar);
    window.print();
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={imprimir}
        disabled={mesas.length === 0}
      >
        <Printer className="size-4" />
        Imprimir QRs
      </Button>

      <div
        id={ID_DA_FOLHA}
        aria-hidden
        style={{ position: "fixed", left: -10000, top: 0, width: "186mm" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "8mm",
            fontFamily: "system-ui, sans-serif",
            color: "#000",
          }}
        >
          {mesas.map((mesa) => (
            <div
              key={mesa.id}
              style={{
                border: "1px dashed #999",
                borderRadius: "4mm",
                padding: "5mm",
                textAlign: "center",
                breakInside: "avoid",
              }}
            >
              <div style={{ fontSize: "11pt", marginBottom: "2mm" }}>
                Peça pelo celular
              </div>
              <div style={{ fontSize: "26pt", fontWeight: 800, lineHeight: 1 }}>
                {mesa.number}
              </div>
              {mesa.name && (
                <div style={{ fontSize: "9pt", marginTop: "1mm" }}>
                  {mesa.name}
                </div>
              )}
              <div style={{ margin: "3mm 0" }}>
                {origem && (
                  <QRCodeSVG
                    value={`${origem}/mesa/${mesa.qrToken}`}
                    size={110}
                    level="M"
                  />
                )}
              </div>
              <div style={{ fontSize: "7pt", color: "#555" }}>
                Aponte a câmera do celular
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
