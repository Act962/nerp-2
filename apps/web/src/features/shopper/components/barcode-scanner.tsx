"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CameraOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Tipos mínimos da API nativa `BarcodeDetector` (ainda fora do lib.dom padrão).
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: {
  formats?: string[];
}) => BarcodeDetectorLike;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const;

/** Intervalo entre tentativas de leitura. */
const TICK_MS = 350;

/**
 * Lado maior do quadro entregue ao decodificador.
 *
 * O vídeo pode chegar em 4K; decodificar isso a cada tick derruba o frame rate
 * no celular. 1080 mantém as barras finas de um EAN-13 legíveis com folga.
 */
const MAX_FRAME_EDGE = 1080;

type Status = "starting" | "scanning" | "unsupported" | "denied" | "error";

/**
 * Resolve o detector: nativo quando existe (Chrome/Android — acelerado pelo
 * sistema), senão o ponyfill em WebAssembly.
 *
 * O ponyfill entra por import dinâmico de propósito: são ~1 MB de wasm que só
 * o iOS Safari e o Firefox precisam baixar, e a tela é pública, aberta no
 * celular do cliente dentro da loja.
 */
async function resolveDetector(): Promise<BarcodeDetectorLike> {
  const native = (
    window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
  ).BarcodeDetector;
  if (native) return new native({ formats: [...FORMATS] });

  const { BarcodeDetector, prepareZXingModule } = await import(
    "barcode-detector/ponyfill"
  );
  // Sem isso o wasm vem do jsDelivr; servimos do próprio domínio (ver
  // scripts/copy-zxing-wasm.mjs).
  prepareZXingModule({
    overrides: { locateFile: () => "/wasm/zxing_reader.wasm" },
  });
  return new BarcodeDetector({ formats: [...FORMATS] });
}

// Scanner de código de barras por câmera. Funciona em qualquer navegador com
// acesso à câmera em contexto seguro (HTTPS), inclusive iOS Safari.
export function BarcodeScanner({
  onDetect,
  continuous = false,
}: {
  onDetect: (code: string) => void;
  /**
   * Segue lendo depois do primeiro código, em vez de parar a câmera.
   *
   * O padrão é PARAR: o fluxo do Shopper lê um produto e vai para a tela dele.
   * Já o celular usado como leitor do PDV precisa passar item atrás de item —
   * ali, parar significaria reiniciar a câmera a cada bipe. Quem liga isto
   * assume a responsabilidade de ignorar releitura do mesmo código, porque a
   * câmera continua enxergando o mesmo item por vários quadros.
   */
  continuous?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  // Recriar o efeito reinicia a câmera. O pai redefine `onDetect` a cada
  // render (digitar no campo manual já bastava), então a referência fica num
  // ref e sai das dependências.
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;
  // Em ref pelo mesmo motivo do `onDetect`: mudar a prop não pode reiniciar a
  // câmera no meio da operação.
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;
  // Trocado para forçar uma nova tentativa depois de erro/negação — aí a
  // chamada nasce de um toque, que é o contexto em que o iOS reabre o pedido
  // de permissão.
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` não é lido dentro do efeito — é justamente o gatilho de reexecução do "Tentar novamente"
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    let canvas: HTMLCanvasElement | null = null;

    /**
     * Reduz o quadro antes de decodificar.
     *
     * Também resolve um detalhe do iOS: passar o `<video>` direto ao ponyfill
     * exige que o navegador saiba criar um ImageBitmap dele, o que nem toda
     * versão do Safari faz de forma confiável. O canvas é o caminho comum.
     */
    function grabFrame(video: HTMLVideoElement): CanvasImageSource | null {
      const { videoWidth, videoHeight } = video;
      if (!videoWidth || !videoHeight) return null;

      const scale = Math.min(
        1,
        MAX_FRAME_EDGE / Math.max(videoWidth, videoHeight),
      );
      const width = Math.round(videoWidth * scale);
      const height = Math.round(videoHeight * scale);

      if (!canvas) canvas = document.createElement("canvas");
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(video, 0, 0, width, height);
      return canvas;
    }

    async function start() {
      let detector: BarcodeDetectorLike;
      try {
        detector = await resolveDetector();
      } catch {
        if (!done) setStatus("unsupported");
        return;
      }
      if (done) return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (done) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (done) return;
        setStatus("scanning");
      } catch (error) {
        if (done) return;
        const name = (error as { name?: string })?.name;
        setStatus(name === "NotAllowedError" ? "denied" : "error");
        return;
      }

      // Laço que se reagenda em vez de setInterval: o decodificador em wasm
      // pode levar mais que um tick, e sobrepor leituras só enfileira trabalho.
      const tick = async () => {
        if (done) return;
        const video = videoRef.current;
        if (video) {
          try {
            const frame = grabFrame(video);
            if (frame) {
              const codes = await detector.detect(frame);
              const hit = codes.find((code) => /^\d{8,}$/.test(code.rawValue));
              if (hit && !done) {
                if (!continuousRef.current) done = true;
                onDetectRef.current(hit.rawValue);
                if (done) return;
              }
            }
          } catch {
            // quadro sem leitura — ignora e tenta no próximo
          }
        }
        if (!done) timer = setTimeout(tick, TICK_MS);
      };
      timer = setTimeout(tick, TICK_MS);
    }

    start();

    return () => {
      done = true;
      if (timer) clearTimeout(timer);
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus("starting");
    setAttempt((value) => value + 1);
  }, []);

  // Antes esse caso devolvia null e a área do scanner sumia sem explicação —
  // era exatamente o que o iPhone via.
  if (status === "unsupported") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        <CameraOff className="size-6" />
        <p>
          Este navegador não permite abrir a câmera. Digite o código de barras
          abaixo ou envie uma foto do produto.
        </p>
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-black">
      <video
        ref={videoRef}
        className="size-full object-cover"
        playsInline
        muted
        autoPlay
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-4 text-center text-sm text-white">
          <CameraOff className="size-6" />
          <p>
            {status === "denied"
              ? "Permita o acesso à câmera para escanear, ou digite o código abaixo."
              : "Não foi possível abrir a câmera. Digite o código abaixo."}
          </p>
          <Button size="sm" variant="secondary" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
}
