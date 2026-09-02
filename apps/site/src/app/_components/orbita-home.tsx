"use client";

import { OrbitaExperience } from "@/orbita";
import type { SitePartnersResponse } from "@nerp/site-content";
import type { SiteContent } from "@/orbita/data/content";
import { SiteContentProvider } from "@/orbita/lib/content-context";
import { PartnersProvider } from "@/orbita/lib/partners-context";

/**
 * Ponte entre o site e o produto.
 *
 * Aqui não há sessão: este app não conhece o better-auth, e descobrir se
 * alguém está logado custaria uma chamada com credenciais a outro domínio
 * para decidir o texto de um botão. Os dois botões apontam para o ERP, que é
 * quem sabe se manda para o login ou para o painel.
 */
export function OrbitaHome({
  content,
  partners,
  loginHref,
  signupHref,
}: {
  content: SiteContent;
  partners: SitePartnersResponse;
  loginHref: string;
  signupHref: string;
}) {
  return (
    <SiteContentProvider content={content}>
      <PartnersProvider value={partners}>
        <OrbitaExperience appHref={loginHref} signupHref={signupHref} />
      </PartnersProvider>
    </SiteContentProvider>
  );
}
