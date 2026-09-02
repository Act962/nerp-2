"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SitePartnersResponse } from "@nerp/site-content";

/**
 * Os parceiros e as marcas atravessam a árvore por contexto, como o resto do
 * conteúdo — e pelo mesmo motivo: os blocos estão longe da página, e passar as
 * listas de mão em mão obrigaria a mexer em componentes que não têm nada a ver
 * com elas.
 *
 * O padrão é vazio, e é o padrão certo: um componente montado fora do provedor
 * não inventa parceiro nenhum.
 */
const VAZIO: SitePartnersResponse = { partners: [], brands: [] };

const PartnersContext = createContext<SitePartnersResponse>(VAZIO);

export function PartnersProvider({
  value,
  children,
}: {
  value?: SitePartnersResponse | null;
  children: ReactNode;
}) {
  return (
    <PartnersContext.Provider value={value ?? VAZIO}>
      {children}
    </PartnersContext.Provider>
  );
}

export function usePartners() {
  return useContext(PartnersContext);
}
