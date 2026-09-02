"use client";

import { useEffect, useState } from "react";
import { detectQuality, type QualitySettings } from "../lib/quality";

/** WebGL disponível? Testado uma vez, com contexto descartado em seguida. */
function probeWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    const lose = (gl as WebGLRenderingContext).getExtension(
      "WEBGL_lose_context",
    );
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export type Environment = {
  ready: boolean;
  webgl: boolean;
  reducedMotion: boolean;
  quality: QualitySettings;
  /** true quando a composição deve ser a de celular (não é só "menor"). */
  compact: boolean;
};

export function useEnvironment(): Environment {
  const [env, setEnv] = useState<Environment>(() => ({
    ready: false,
    webgl: true,
    reducedMotion: false,
    quality: detectQuality(),
    compact: false,
  }));

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 860px)");

    const read = () =>
      setEnv({
        ready: true,
        webgl: probeWebGL(),
        reducedMotion: motion.matches,
        quality: detectQuality(),
        compact: compact.matches,
      });

    read();
    motion.addEventListener("change", read);
    compact.addEventListener("change", read);
    return () => {
      motion.removeEventListener("change", read);
      compact.removeEventListener("change", read);
    };
  }, []);

  return env;
}
