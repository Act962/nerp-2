"use client";

import { useCallback, useEffect, useState } from "react";

// Estado da permissão de notificação do SO — permite decidir se o alerta pode
// aparecer FORA da aba (barra do sistema) além do toast dentro do dashboard.
//
// A permissão vale por origem (dashboard inteiro), não por widget. Cada
// widget tem seu próprio toggle "notificar no sistema" e só respeita ele se
// o usuário tiver concedido a permissão globalmente.

export type NotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

function currentPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as NotificationPermissionState;
}

export function useNotificationPermission() {
  const [permission, setPermission] =
    useState<NotificationPermissionState>("unsupported");

  useEffect(() => {
    setPermission(currentPermission());
  }, []);

  const request =
    useCallback(async (): Promise<NotificationPermissionState> => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported";
      }
      try {
        const result = await Notification.requestPermission();
        setPermission(result as NotificationPermissionState);
        return result as NotificationPermissionState;
      } catch {
        return currentPermission();
      }
    }, []);

  const notify = useCallback(
    (title: string, body: string): boolean => {
      if (permission !== "granted") return false;
      try {
        // `tag` = widgetId opcionalmente na próxima; sem tag hoje pra manter
        // simples. Notificações duplicadas serão colapsadas pelo OS mesmo.
        new Notification(title, { body });
        return true;
      } catch {
        return false;
      }
    },
    [permission],
  );

  return { permission, request, notify };
}
