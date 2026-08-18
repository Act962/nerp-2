"use client";

import { createContext, type ReactNode, useContext } from "react";

// Base do storefront no formato aceito pelo <Link>:
//   ""                       → modo subdomínio (hostname já resolve o tenant)
//   "/catalogo/{slug}"       → modo caminho (URL do domínio principal)
//
// O middleware coloca o valor no header `x-catalog-base`; o layout do
// storefront lê e injeta aqui. Componentes consumem via useCatalogHref
// para construir links relativos ao modo atual sem se importar com qual é.
const CatalogBaseContext = createContext<string>("");

export function CatalogBaseProvider({
  base,
  children,
}: {
  base: string;
  children: ReactNode;
}) {
  return (
    <CatalogBaseContext.Provider value={base}>
      {children}
    </CatalogBaseContext.Provider>
  );
}

export function useCatalogBase(): string {
  return useContext(CatalogBaseContext);
}

// Prefixa `path` com o base do modo atual. `path` deve começar com "/"
// (padrão dos <Link href>). Ex.:
//   subdomínio: useCatalogHref("/cart") → "/cart"
//   caminho:    useCatalogHref("/cart") → "/catalogo/gotham/cart"
export function useCatalogHref(path: string): string {
  const base = useCatalogBase();
  if (!path.startsWith("/")) return path; // href externo/hash — não mexe
  return `${base}${path}`;
}
