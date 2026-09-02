"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_CONTENT, type SiteContent } from "../data/content";

/**
 * O conteúdo do site atravessa a árvore por contexto, e não por props.
 *
 * A cena 3D e os blocos de texto estão a muitos níveis de distância da página,
 * e passar o conteúdo de mão em mão obrigaria a mexer em componentes que não
 * têm nada a ver com isso. O valor é lido uma vez por render — não é estado de
 * frame, então contexto não custa nada aqui.
 *
 * O padrão é o conteúdo que já vinha no código: um componente montado fora do
 * provedor (um teste, o fallback isolado) continua funcionando.
 */
const SiteContentContext = createContext<SiteContent>(DEFAULT_CONTENT);

export function SiteContentProvider({
  content,
  children,
}: {
  content?: SiteContent | null;
  children: ReactNode;
}) {
  return (
    <SiteContentContext.Provider value={content ?? DEFAULT_CONTENT}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}
