"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MapPinOff } from "lucide-react";
import { useEffect, useState } from "react";
import { reportGeoState } from "../hooks/use-promotor";

type Perm = "granted" | "denied" | "prompt" | "unavailable";

/**
 * Reporta o estado da permissão de geolocalização ao abrir o app (alimenta o
 * status ao vivo que o gestor vê) e, quando o GPS está desligado/pendente,
 * mostra um aviso para o promotor religar. Nunca bloqueia o app — a captura
 * segue disponível; isto só torna visível quem está sem localização.
 */
export function GpsStatusBanner() {
  const [perm, setPerm] = useState<Perm | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    if (!("geolocation" in navigator)) {
      setPerm("unavailable");
      reportGeoState("unavailable");
      return;
    }

    // Safari antigo não implementa `permissions.query` para geolocalização:
    // assume "prompt" (ainda pode pedir) e reporta.
    if (!navigator.permissions?.query) {
      setPerm("prompt");
      reportGeoState("prompt");
      return;
    }

    let permission: PermissionStatus | null = null;
    const sync = (state: Perm) => {
      setPerm(state);
      reportGeoState(state);
    };

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        permission = result;
        sync(result.state as Perm);
        // Reflete quando o promotor liga/desliga a permissão sem recarregar.
        result.onchange = () => sync(result.state as Perm);
      })
      .catch(() => sync("prompt"));

    return () => {
      if (permission) permission.onchange = null;
    };
  }, []);

  const enable = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator))
      return;
    // Gesto do usuário: dispara o aviso nativo quando ainda está em "prompt".
    navigator.geolocation.getCurrentPosition(
      () => {
        setPerm("granted");
        reportGeoState("granted");
      },
      (error) => {
        if (error.code === 1) {
          setPerm("denied");
          reportGeoState("denied");
        }
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  if (perm === null || perm === "granted") return null;

  const denied = perm === "denied";
  const unavailable = perm === "unavailable";

  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        denied
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
      )}
    >
      <MapPinOff className="mt-0.5 size-4 shrink-0" />
      <div className="flex-1">
        <p className="font-medium">
          {denied
            ? "Localização desativada"
            : unavailable
              ? "Localização indisponível"
              : "Ative a localização"}
        </p>
        <p className="text-xs opacity-90">
          {denied
            ? "Toque no cadeado do site na barra do navegador, permita a Localização e recarregue."
            : unavailable
              ? "Este dispositivo não suporta localização — suas fotos ficarão sem o ponto no mapa."
              : "Durante o expediente o GPS precisa estar ligado para registrarmos suas visitas."}
        </p>
      </div>
      {!denied && !unavailable && (
        <Button type="button" size="sm" variant="outline" onClick={enable}>
          Ativar
        </Button>
      )}
    </div>
  );
}
