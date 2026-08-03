"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  /** Raio de incerteza em metros, como o navegador reporta. */
  accuracy: number;
}

export type GeoStatus = "off" | "asking" | "on" | "denied" | "unavailable";

export interface GeolocationOptions {
  /**
   * Liga sozinho ao montar — mas SÓ se a permissão já estiver concedida.
   *
   * A condição não é excesso de zelo: pedir a posição sem um gesto dispara o
   * aviso do navegador assim que a página abre, e uma negação ali é permanente
   * para a origem inteira. O Chrome não mostra o aviso de novo. Então o
   * primeiro acesso continua exigindo o clique em "Onde estou", e do segundo em
   * diante a tela já abre localizada — que é o comportamento pedido, sem
   * arriscar perder o recurso para sempre no primeiro contato.
   */
  autoStartIfGranted?: boolean;
  /**
   * Reconsulta a posição neste intervalo em vez de manter o GPS observando.
   *
   * `watchPosition` acorda o rádio a cada movimento; num aparelho que passa o
   * dia na rua isso é bateria. Uma consulta a cada poucos minutos mantém o pino
   * útil sem esse custo.
   */
  refreshMs?: number;
}

/**
 * Localização do visitante.
 *
 * Por padrão continua sob demanda e observando (`watchPosition`) — é o que a
 * vitrine pública e a captura precisam. As opções acima cobrem o mapa de campo,
 * que abre já centrado em quem está olhando.
 */
export function useGeolocation(options: GeolocationOptions = {}) {
  const { autoStartIfGranted = false, refreshMs } = options;
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [status, setStatus] = useState<GeoStatus>("off");
  const watchRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAll = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearAll();
    setPosition(null);
    setStatus("off");
  }, [clearAll]);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    clearAll();
    setStatus("asking");

    const onPosition = (event: GeolocationPosition) => {
      setPosition({
        latitude: event.coords.latitude,
        longitude: event.coords.longitude,
        accuracy: event.coords.accuracy,
      });
      setStatus("on");
    };
    const onError = (error: GeolocationPositionError) => {
      // PERMISSION_DENIED = 1. Os outros são falha temporária, e tratar tudo
      // como negado esconderia que basta tentar de novo.
      setStatus(error.code === 1 ? "denied" : "unavailable");
    };
    const config: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 15_000,
    };

    if (refreshMs) {
      navigator.geolocation.getCurrentPosition(onPosition, onError, config);
      timerRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition(onPosition, onError, {
          ...config,
          // Uma posição de até um intervalo atrás serve, e evita acordar o GPS
          // quando o aparelho já sabe onde está.
          maximumAge: refreshMs,
        });
      }, refreshMs);
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      onPosition,
      (error) => {
        onError(error);
        watchRef.current = null;
      },
      config,
    );
  }, [clearAll, refreshMs]);

  useEffect(() => {
    if (!autoStartIfGranted) return;
    if (typeof navigator === "undefined" || !navigator.permissions) return;

    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (!cancelled && permission.state === "granted") start();
      })
      // Safari antigo não implementa `permissions.query` para geolocalização.
      // Sem o auto-start a tela continua inteira: o botão faz o mesmo trabalho.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [autoStartIfGranted, start]);

  // Sem isto o `watchPosition`/timer continua rodando depois de sair da tela —
  // e o GPS ligado é bateria de quem está na rua o dia inteiro.
  useEffect(() => clearAll, [clearAll]);

  return { position, status, start, stop };
}
