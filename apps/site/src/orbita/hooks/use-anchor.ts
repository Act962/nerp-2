"use client";

import { useEffect, useRef } from "react";
import { bindAnchor } from "../lib/store";

/** Prende um elemento HTML a um ponto 3D da cena. */
export function useAnchor<T extends HTMLElement = HTMLDivElement>(id: string) {
  const ref = useRef<T>(null);
  useEffect(() => bindAnchor(id, ref.current), [id]);
  return ref;
}
