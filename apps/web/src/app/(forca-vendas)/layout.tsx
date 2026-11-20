import type { Metadata, Viewport } from "next";
import { Lock } from "lucide-react";
import { RastreadorDeJornada } from "@/features/forca-vendas/components/rastreador-jornada";

// App Força de Vendas: mobile-first como o App Promotor, sem sidebar. Zoom
// desligado pelo mesmo motivo — o vendedor opera com um dedo, em movimento.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1d4ed8",
};

// Atalho na tela inicial: abre o módulo em tela cheia, como um app.
export const metadata: Metadata = {
  manifest: "/forca-de-vendas/app-manifest",
  appleWebApp: {
    capable: true,
    title: "Força de Vendas",
    statusBarStyle: "default",
  },
};

export default function ForcaVendasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Fica no layout para seguir registrando a jornada em qualquer tela do módulo. */}
      <RastreadorDeJornada />
      <main className="flex-1">{children}</main>
      <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
        <p className="flex items-center justify-center gap-1.5">
          <span>Desenvolvido por</span>
          {/* biome-ignore lint/performance/noImgElement: asset SVG estático em /public, sem otimização do next/image */}
          <img
            src="/orbita-hub.svg"
            alt="Órbita Hub"
            className="h-4 w-auto invert dark:invert-0"
          />
        </p>
        <p className="mt-1 inline-flex items-center gap-1">
          <Lock className="size-3" />
          Página Criptografada e protegida
        </p>
      </footer>
    </div>
  );
}
