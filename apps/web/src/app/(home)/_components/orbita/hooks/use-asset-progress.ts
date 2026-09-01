"use client";

import { useEffect, useState } from "react";
import { DefaultLoadingManager } from "three";

/**
 * Progresso de carregamento das texturas.
 *
 * Usa o loading manager padrão do three em vez do `useProgress` do drei: é a
 * mesma informação, sem trazer a biblioteca inteira para o bundle de um ERP
 * que só precisa dela nesta página.
 */
export function useAssetProgress() {
  const [state, setState] = useState({ active: true, progress: 0 });

  useEffect(() => {
    const manager = DefaultLoadingManager;
    const prevStart = manager.onStart;
    const prevProgress = manager.onProgress;
    const prevLoad = manager.onLoad;
    const prevError = manager.onError;

    manager.onStart = (url, loaded, total) => {
      setState({ active: true, progress: total ? (loaded / total) * 100 : 0 });
      prevStart?.(url, loaded, total);
    };
    manager.onProgress = (url, loaded, total) => {
      setState({
        active: loaded < total,
        progress: total ? (loaded / total) * 100 : 0,
      });
      prevProgress?.(url, loaded, total);
    };
    manager.onLoad = () => {
      setState({ active: false, progress: 100 });
      prevLoad?.();
    };
    manager.onError = (url) => {
      // Uma textura que falha não pode prender o véu na tela para sempre.
      setState({ active: false, progress: 100 });
      prevError?.(url);
    };

    // Se nada começou a carregar em 6s, a cena não depende mais do véu.
    const bail = setTimeout(
      () => setState({ active: false, progress: 100 }),
      6000,
    );

    return () => {
      clearTimeout(bail);
      manager.onStart = prevStart;
      manager.onProgress = prevProgress;
      manager.onLoad = prevLoad;
      manager.onError = prevError;
    };
  }, []);

  return state;
}
