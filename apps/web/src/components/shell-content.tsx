"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Rotas de editor em tela cheia: o respiro padrão (p-4/md:p-6) e o breadcrumb só
// roubam altura útil. Nelas o conteúdo ocupa toda a área do <main>.
const FULLSCREEN_PREFIXES = ["/catalogo-promocional/"];

export function isFullscreenRoute(pathname: string) {
  return FULLSCREEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullscreen = isFullscreenRoute(pathname);

  return (
    <div
      className={cn(
        fullscreen ? "h-full w-full" : "w-full space-y-6 p-4 md:p-6",
      )}
    >
      {children}
    </div>
  );
}
