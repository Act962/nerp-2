"use client";

import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";

/**
 * QR do pareamento num cartão com profundidade.
 *
 * O efeito 3D fica no CARTÃO, nunca no código. Um QR inclinado perde contraste
 * e paralelismo das linhas — a câmera do celular passa a errar a leitura, que é
 * exatamente o que este recurso precisa acertar. Então: cartão gira com o
 * ponteiro, código permanece plano e de frente.
 */
const MAX_TILT_DEG = 12;

export function ScannerQrCard({
  value,
  size = 208,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const px = (event.clientX - box.left) / box.width - 0.5;
    const py = (event.clientY - box.top) / box.height - 0.5;
    setTilt({ x: -py * MAX_TILT_DEG * 2, y: px * MAX_TILT_DEG * 2 });
  };

  return (
    <div className={cn("[perspective:900px]", className)}>
      <div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        className="rounded-2xl border bg-card p-5 shadow-xl transition-transform duration-150 ease-out [transform-style:preserve-3d]"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        {/* O código sai do plano do cartão, mas continua de frente: ganha
            profundidade sem inclinar as linhas que a câmera precisa ler. */}
        <div
          className="rounded-lg bg-white p-3"
          style={{ transform: "translateZ(28px)" }}
        >
          <QRCodeSVG value={value} size={size} level="M" />
        </div>
      </div>
    </div>
  );
}
