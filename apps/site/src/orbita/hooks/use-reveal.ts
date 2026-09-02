"use client";

import { useEffect, useRef } from "react";
import { registerReveal, type RevealOptions } from "../lib/reveal";

/** Liga um elemento à janela de progresso em que ele deve existir. */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options: RevealOptions,
  enabled = true,
) {
  const ref = useRef<T>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  // As opções vivem num ref porque só as fronteiras da janela precisam
  // reassinar o registro; o objeto inteiro nas deps recriaria tudo a cada render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps intencionais
  useEffect(() => {
    if (!enabled || !ref.current) return;
    return registerReveal(ref.current, optsRef.current);
  }, [
    enabled,
    options.inStart,
    options.inEnd,
    options.outStart,
    options.outEnd,
    options.stagger,
  ]);

  return ref;
}
