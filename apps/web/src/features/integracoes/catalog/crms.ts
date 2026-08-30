import type { ProviderManifest } from "./types";

/**
 * CRMs externos.
 *
 * O nerp tem CRM próprio (o módulo WhatsApp), mas quem já usa o Órbita
 * hospedado não precisa migrar: liga a conta de lá e os dois trabalham juntos —
 * o Órbita passa a ler produtos, estoque, clientes e vendas daqui.
 */
export const orbitaCrm: ProviderManifest = {
  id: "orbita-crm",
  nome: "Órbita CRM",
  categoria: "CRM",
  logo: "/integracoes/orbita-crm.svg",
  cor: "#6366f1",
  resumo:
    "Conecte sua conta do Órbita para ela ler produtos, estoque, clientes e vendas do nerp.",
  // A conexão é por autorização, não por credencial digitada: nada de
  // formulário. Daí o painel próprio.
  auth: { tipo: "OAUTH2_AUTHORIZATION_CODE", campos: [] },
  capacidades: [],
  ambientes: ["producao"],
  disponivel: true,
  painelProprio: "orbita-crm",
  docsUrl: "https://orbita.nasaex.com/",
};

export const crms: ProviderManifest[] = [orbitaCrm];
