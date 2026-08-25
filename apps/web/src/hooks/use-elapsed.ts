"use client";

import { useEffect, useState } from "react";

// Relógio que recalcula "agora" a cada segundo, para o tempo decorrido subir
// suave entre os pollings (5s) sem nenhuma ida ao servidor.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

// Tempo decorrido desde uma data ISO. Escala a unidade conforme o intervalo:
// < 1 min → "Xs", < 1 h → "Mm" (com segundos opcionais), >= 1 h → "Hh Mm".
// Mantém formato curto para caber junto dos demais badges do card.
export function formatElapsed(createdAtIso: string, now: number) {
  const ms = Math.max(0, now - new Date(createdAtIso).getTime());
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) {
    const s = totalSec % 60;
    return s ? `${totalMin}m ${s}s` : `${totalMin}m`;
  }
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
