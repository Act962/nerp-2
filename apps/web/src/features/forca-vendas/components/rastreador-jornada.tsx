"use client";

import { useEffect, useRef } from "react";
import {
  useJornadaFv,
  useRegistrarLocalizacaoFv,
} from "../hooks/use-forca-vendas";

type Ponto = {
  capturadoEm: string;
  latitude: number;
  longitude: number;
  precisaoM: number | null;
  bateria: number | null;
};

// Um ponto por minuto ou a cada 50 m, o que vier primeiro, enviados em lote.
const INTERVALO_MS = 60_000;
const DISTANCIA_MINIMA_M = 50;
const ENVIO_MS = 2 * 60_000;

type BatteryManager = { level: number };
type NavigatorComBateria = Navigator & {
  getBattery?: () => Promise<BatteryManager>;
};
type WakeLockSentinel = { release: () => Promise<void> };
type NavigatorComWakeLock = Navigator & {
  wakeLock?: { request: (tipo: "screen") => Promise<WakeLockSentinel> };
};

function distancia(a: Ponto, b: Ponto): number {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Registra a localização enquanto a jornada está aberta e o módulo está na
 * tela. Num módulo de navegador não há rastreio com a tela bloqueada; a tela
 * fica acesa (Wake Lock) enquanto a jornada roda para cobrir o dia de rua.
 * Fora da jornada, nada é lido nem enviado.
 */
export function RastreadorDeJornada() {
  const { data: jornada } = useJornadaFv();
  const registrar = useRegistrarLocalizacaoFv();
  const fila = useRef<Ponto[]>([]);
  const ultimo = useRef<Ponto | null>(null);
  const { mutate } = registrar;
  const aberta = jornada?.aberta === true;

  useEffect(() => {
    if (
      !aberta ||
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      return;
    }
    let bateria: BatteryManager | null = null;
    (navigator as NavigatorComBateria)
      .getBattery?.()
      .then((manager) => {
        bateria = manager;
      })
      .catch(() => undefined);

    let trava: WakeLockSentinel | null = null;
    const pedirTrava = () => {
      (navigator as NavigatorComWakeLock).wakeLock
        ?.request("screen")
        .then((sentinela) => {
          trava = sentinela;
        })
        .catch(() => undefined);
    };
    pedirTrava();
    // O navegador solta a trava quando a aba some; ao voltar, pedimos de novo.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") pedirTrava();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    const enviar = () => {
      if (fila.current.length === 0) return;
      const pontos = fila.current.splice(0, fila.current.length);
      mutate(
        { origem: "PING", pontos },
        // Sem sinal: devolve à fila para o próximo envio.
        { onError: () => fila.current.unshift(...pontos) },
      );
    };

    const vigia = navigator.geolocation.watchPosition(
      (posicao) => {
        const ponto: Ponto = {
          capturadoEm: new Date(posicao.timestamp).toISOString(),
          latitude: posicao.coords.latitude,
          longitude: posicao.coords.longitude,
          precisaoM: posicao.coords.accuracy,
          bateria: bateria ? Math.round(bateria.level * 100) : null,
        };
        const anterior = ultimo.current;
        const passouTempo =
          !anterior ||
          new Date(ponto.capturadoEm).getTime() -
            new Date(anterior.capturadoEm).getTime() >=
            INTERVALO_MS;
        if (
          passouTempo ||
          (anterior && distancia(anterior, ponto) >= DISTANCIA_MINIMA_M)
        ) {
          ultimo.current = ponto;
          fila.current.push(ponto);
          if (fila.current.length > 500) fila.current.shift();
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 },
    );
    const temporizador = window.setInterval(enviar, ENVIO_MS);

    return () => {
      navigator.geolocation.clearWatch(vigia);
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", aoVoltar);
      trava?.release().catch(() => undefined);
      enviar();
    };
  }, [aberta, mutate]);

  return null;
}
