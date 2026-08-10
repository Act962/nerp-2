"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { constructUrl } from "@/hooks/use-construct-url";
import { usePdvMediaPanel } from "../hooks/use-pdv-media";

// Painel de mídia na coluna esquerda do PDV. Ocupa exatamente o espaço da
// sidebar oculta (offcanvas): ao abrir o menu (state = "expanded"), some para o
// menu aparecer no lugar. Carrossel próprio (não embla) porque vídeo precisa
// tocar até o fim e há uma pausa global entre as mídias.
export function PdvMediaPanel() {
  const { medias, settings } = usePdvMediaPanel();
  const { state, isMobile } = useSidebar();
  const [idx, setIdx] = useState(0);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const count = medias.length;
  const pauseMs = settings.pauseSeconds * 1000;
  // `idx` clampado: se a lista encolhe (remoção), o módulo mantém válido sem
  // um effect de reset (que o lint acusaria de dependência supérflua).
  const activeIdx = count > 0 ? idx % count : 0;

  const scheduleAdvance = useCallback(() => {
    if (count <= 1) return;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => {
      setIdx((i) => (i + 1) % count);
    }, pauseMs);
  }, [count, pauseMs]);

  // Imagem/GIF: avança após `durationSeconds`. Vídeo avança no onEnded.
  useEffect(() => {
    const current = medias[activeIdx];
    if (!current || current.type === "VIDEO" || count <= 1) return;
    const dwell = setTimeout(scheduleAdvance, current.durationSeconds * 1000);
    return () => clearTimeout(dwell);
  }, [activeIdx, medias, count, scheduleAdvance]);

  useEffect(
    () => () => {
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
    },
    [],
  );

  // Esconde: no mobile, com painel desligado, sem mídia, ou com o menu aberto.
  if (isMobile || !settings.enabled || count === 0 || state === "expanded")
    return null;

  const current = medias[activeIdx];
  if (!current) return null;

  return (
    <aside className="sticky top-0 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-hidden bg-black lg:block">
      {current.type === "VIDEO" ? (
        // biome-ignore lint/a11y/useMediaCaption: mídia promocional, sem áudio
        <video
          key={current.id}
          src={constructUrl(current.url)}
          className="h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          loop={count === 1}
          onEnded={scheduleAdvance}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.id}
          src={constructUrl(current.url)}
          alt={current.title ?? "Mídia promocional"}
          className="h-full w-full object-cover"
        />
      )}
    </aside>
  );
}
