"use client";

import { Spinner } from "@/components/ui/spinner";
import { CameraOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Tipos mínimos da API nativa `BarcodeDetector` (ainda fora do lib.dom padrão).
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: {
  formats?: string[];
}) => BarcodeDetectorLike;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

type Status = "starting" | "scanning" | "unsupported" | "denied" | "error";

// Scanner de código de barras por câmera usando a API nativa BarcodeDetector
// (Chrome/Android). Sem suporte (ex.: iOS Safari) → sinaliza para o pai cair no
// campo manual. Emite `onDetect(code)` uma única vez e para a câmera.
export function BarcodeScanner({
  onDetect,
}: {
  onDetect: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");

  useEffect(() => {
    const ctor = (
      window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
    ).BarcodeDetector;
    if (!ctor || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;
    const detector = new ctor({ formats: FORMATS });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("scanning");

        timer = setInterval(async () => {
          if (done || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const hit = codes.find((code) => /^\d{8,}$/.test(code.rawValue));
            if (hit && !done) {
              done = true;
              onDetect(hit.rawValue);
            }
          } catch {
            // frame sem leitura — ignora e tenta no próximo tick
          }
        }, 400);
      } catch (error) {
        const name = (error as { name?: string })?.name;
        setStatus(name === "NotAllowedError" ? "denied" : "error");
      }
    }

    start();

    return () => {
      done = true;
      if (timer) clearInterval(timer);
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [onDetect]);

  if (status === "unsupported") return null;

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-black">
      <video
        ref={videoRef}
        className="size-full object-cover"
        playsInline
        muted
      >
        <track kind="captions" />
      </video>
      {/* Mira + laser de scan (barra vermelha descendo e subindo) */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <style>{`
@keyframes tg-scan-laser { from { top: 6%; } to { top: 92%; } }
`}</style>
        <div className="relative h-40 w-64 overflow-hidden rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
          {status === "scanning" && (
            <span className="absolute inset-x-2 h-0.5 rounded-full bg-red-500 shadow-[0_0_12px_3px_rgba(239,68,68,0.85)] [animation:tg-scan-laser_2.2s_ease-in-out_infinite_alternate]" />
          )}
        </div>
      </div>
      {status === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <Spinner />
        </div>
      )}
      {(status === "denied" || status === "error") && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white">
          <CameraOff className="size-6" />
          {status === "denied"
            ? "Permita o acesso à câmera ou digite o código abaixo."
            : "Não foi possível abrir a câmera. Digite o código abaixo."}
        </div>
      )}
    </div>
  );
}
