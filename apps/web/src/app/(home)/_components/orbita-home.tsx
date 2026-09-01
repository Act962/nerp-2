"use client";

import { authClient } from "@/lib/auth-client";
import { OrbitaExperience } from "./orbita";
import type { SiteContent } from "./orbita/data/content";
import { SiteContentProvider } from "./orbita/lib/content-context";

/**
 * Ponte entre o site institucional e o produto.
 *
 * A experiência 3D não conhece autenticação nem banco — ela recebe para onde
 * apontar e lê o conteúdo do contexto. Aqui a sessão decide se o botão leva ao
 * login ou direto ao painel.
 */
export function OrbitaHome({ content }: { content?: SiteContent }) {
  const { data: session, isPending } = authClient.useSession();
  const appHref = !isPending && session?.user ? "/dashboard" : "/login";

  return (
    <SiteContentProvider content={content}>
      <OrbitaExperience appHref={appHref} />
    </SiteContentProvider>
  );
}
