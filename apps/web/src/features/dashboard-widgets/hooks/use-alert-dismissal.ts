"use client";

import { useCallback, useEffect, useState } from "react";

// Rastreio de "já vi este alerta" em localStorage — sem tabela nem migração.
// Chave = `${widgetId}:${lastFiredAtISO}`. Assim, se o cron disparar de novo
// amanhã, o novo `lastFiredAt` invalida a chave antiga e o toast reaparece.
//
// Escopo: por dispositivo (que é a semântica de localStorage). Aceito para o
// MVP; multi-device sync exigiria uma tabela `WidgetAlertReceipt`.

const STORAGE_KEY = "dashboard-widget-alert-dismissals";
const MAX_ENTRIES = 200;

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((item): item is string => typeof item === "string"),
    );
  } catch {
    return new Set();
  }
}

function writeSet(next: Set<string>): void {
  if (typeof window === "undefined") return;
  // Trim: mantém só as últimas MAX_ENTRIES para o storage não crescer sem fim.
  const list = [...next].slice(-MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // storage cheio ou negado — dispensa o registro silenciosamente
  }
}

function keyFor(widgetId: string, firedAt: string | null): string | null {
  if (!firedAt) return null;
  return `${widgetId}:${firedAt}`;
}

export function useAlertDismissal() {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setDismissed(readSet());
  }, []);

  const isDismissed = useCallback(
    (widgetId: string, firedAt: string | null): boolean => {
      const key = keyFor(widgetId, firedAt);
      return !!key && dismissed.has(key);
    },
    [dismissed],
  );

  const dismiss = useCallback(
    (widgetId: string, firedAt: string | null): void => {
      const key = keyFor(widgetId, firedAt);
      if (!key) return;
      setDismissed((current) => {
        if (current.has(key)) return current;
        const next = new Set(current);
        next.add(key);
        writeSet(next);
        return next;
      });
    },
    [],
  );

  return { isDismissed, dismiss };
}
