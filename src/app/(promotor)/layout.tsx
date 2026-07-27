import { Lock } from "lucide-react";

// App do promotor: mobile-first, sem sidebar/header do dashboard. Rodapé com a
// marca Órbita Hub + selo de segurança.
export default function PromotorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
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
