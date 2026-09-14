"use client";

import { useEffect, useRef } from "react";

type SentinelaDeTela = { release(): Promise<void> };
type WakeLockApi = { request(tipo: "screen"): Promise<SentinelaDeTela> };

/**
 * Mantém a tela acesa enquanto a estação de impressão estiver aberta.
 *
 * A estação vive no celular do dono, encostada no balcão: se a tela apagar, o
 * navegador para de buscar pedidos e o cupom não sai. O detalhe que sempre
 * escapa é que o sistema LIBERA o bloqueio sozinho quando a aba sai de vista —
 * por isso o `visibilitychange` readquire, senão a primeira notificação que
 * chegar mata o bloqueio para o resto do expediente.
 */
export function useWakeLock(ativo: boolean) {
  const sentinela = useRef<SentinelaDeTela | null>(null);

  useEffect(() => {
    if (!ativo) return;

    const wakeLock = (navigator as Navigator & { wakeLock?: WakeLockApi })
      .wakeLock;
    if (!wakeLock) return;

    let cancelado = false;

    const pedir = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const nova = await wakeLock.request("screen");
        if (cancelado) {
          void nova.release();
          return;
        }
        sentinela.current = nova;
      } catch {
        // Bateria baixa ou política do sistema. A estação continua útil; só a
        // tela pode apagar.
      }
    };

    void pedir();
    document.addEventListener("visibilitychange", pedir);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", pedir);
      void sentinela.current?.release();
      sentinela.current = null;
    };
  }, [ativo]);
}
