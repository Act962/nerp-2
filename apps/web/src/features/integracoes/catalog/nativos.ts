import type { ProviderManifest } from "./types";

// As três integrações que existiam antes do catálogo. Entram no mesmo grid para
// haver um modelo mental só, mas abrem o painel que já tinham (`painelProprio`)
// em vez do formulário derivado do manifesto.

export const winthor: ProviderManifest = {
  id: "winthor",
  nome: "Winthor (TOTVS)",
  categoria: "ERP",
  logo: "/integracoes/winthor.svg",
  cor: "#0057A6",
  resumo: "Leitura direta do Oracle do ERP, somente SELECT.",
  auth: { tipo: "API_KEY", campos: [] },
  capacidades: [],
  ambientes: ["producao"],
  disponivel: true,
  painelProprio: "winthor",
};

export const focusNfe: ProviderManifest = {
  id: "focus-nfe",
  nome: "Focus NFe",
  categoria: "FISCAL",
  logo: "/integracoes/focus-nfe.svg",
  cor: "#1F6FEB",
  resumo: "Emissão de NFC-e e NF-e com certificado A1.",
  auth: { tipo: "API_KEY", campos: [] },
  capacidades: [],
  ambientes: ["sandbox", "producao"],
  disponivel: true,
  painelProprio: "fiscal",
};

export const googleDrive: ProviderManifest = {
  id: "google-drive",
  nome: "Google Drive",
  categoria: "PRODUTIVIDADE",
  logo: "/integracoes/google-drive.svg",
  cor: "#0F9D58",
  resumo: "Importar planilhas e arquivos direto do Drive.",
  auth: { tipo: "OAUTH2_AUTHORIZATION_CODE", campos: [] },
  capacidades: [],
  ambientes: ["producao"],
  disponivel: true,
  painelProprio: "google-drive",
};

export const nativos: ProviderManifest[] = [winthor, focusNfe, googleDrive];
