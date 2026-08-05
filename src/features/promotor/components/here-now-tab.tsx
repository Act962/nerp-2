"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/spinner";

// Leaflet mexe em `window` no top-level do módulo — importar direto derruba o
// SSR com `window is not defined`. `ssr:false` é a única fronteira segura,
// mesmo padrão do RouteMapCanvas / mapa-de-campo.
const HereNowCanvas = dynamic(
  () =>
    import("./here-now-canvas").then((mod) => ({ default: mod.HereNowCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full items-center justify-center rounded-lg border">
        <Spinner />
      </div>
    ),
  },
);

export function HereNowTab() {
  return <HereNowCanvas />;
}
