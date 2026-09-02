import type { CredentialField, ProviderManifest } from "./types";

// Banco brasileiro é quase sempre OAuth2 client_credentials + mTLS. O par
// certificado/chave se repete, então mora aqui em vez de em cada manifesto.
const certificadoMtls: CredentialField[] = [
  {
    key: "certificado",
    label: "Certificado (.crt)",
    tipo: "file",
    aceita: [".crt", ".pem", ".cer"],
  },
  {
    key: "chavePrivada",
    label: "Chave privada (.key)",
    tipo: "file",
    aceita: [".key", ".pem"],
  },
];

export const inter: ProviderManifest = {
  id: "inter",
  nome: "Banco Inter",
  categoria: "BANCO",
  logo: "/integracoes/inter.svg",
  cor: "#FF7A00",
  resumo: "Extrato e saldo da conta PJ, direto da API do Inter.",
  auth: {
    tipo: "OAUTH2_CLIENT_CREDENTIALS",
    mtls: true,
    scopes: ["extrato.read"],
    campos: [
      {
        key: "clientId",
        label: "Client ID",
        tipo: "text",
        ajuda: "Internet Banking → Soluções para sua empresa → Nova Integração",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        tipo: "password",
        ajuda: "Gerado junto do Client ID — só aparece uma vez",
      },
      {
        key: "contaCorrente",
        label: "Conta corrente",
        tipo: "text",
        placeholder: "123456789",
        ajuda: "Sem o dígito verificador",
      },
      ...certificadoMtls,
    ],
  },
  capacidades: ["extrato", "saldo"],
  ambientes: ["producao"],
  disponivel: true,
  docsUrl: "https://developers.inter.co/",
};

export const sicoob: ProviderManifest = {
  id: "sicoob",
  nome: "Sicoob",
  categoria: "BANCO",
  logo: "/integracoes/sicoob.svg",
  cor: "#00AE9D",
  resumo: "Conta corrente: extrato e saldo pela API do Sicoob.",
  auth: {
    tipo: "OAUTH2_CLIENT_CREDENTIALS",
    mtls: true,
    campos: [
      {
        key: "clientId",
        label: "Client ID",
        tipo: "text",
        ajuda: "developers.sicoob.com.br → cadastro de aplicação",
      },
      {
        key: "certificadoPfx",
        label: "Certificado ICP-Brasil (.pfx)",
        tipo: "file",
        aceita: [".pfx", ".p12"],
      },
      {
        key: "senhaCertificado",
        label: "Senha do certificado",
        tipo: "password",
      },
    ],
  },
  capacidades: ["extrato", "saldo"],
  ambientes: ["sandbox", "producao"],
  disponivel: false,
};

export const sicredi: ProviderManifest = {
  id: "sicredi",
  nome: "Sicredi",
  categoria: "BANCO",
  logo: "/integracoes/sicredi.svg",
  cor: "#3FA110",
  resumo: "Extrato de conta corrente pela API do Sicredi.",
  auth: {
    tipo: "OAUTH2_CLIENT_CREDENTIALS",
    mtls: true,
    campos: [
      { key: "clientId", label: "Client ID", tipo: "text" },
      { key: "clientSecret", label: "Client Secret", tipo: "password" },
      {
        key: "codigoAcesso",
        label: "Código de acesso",
        tipo: "password",
        ajuda: "Fornecido pela cooperativa junto das credenciais",
      },
      ...certificadoMtls,
    ],
  },
  capacidades: ["extrato", "saldo"],
  ambientes: ["sandbox", "producao"],
  disponivel: false,
  preRequisito: "O certificado passa por CSR validado pelo Sicredi.",
};

export const bancoDoBrasil: ProviderManifest = {
  id: "banco-do-brasil",
  nome: "Banco do Brasil",
  categoria: "BANCO",
  logo: "/integracoes/banco-do-brasil.svg",
  cor: "#FFEF38",
  resumo: "API de Extratos: lançamentos e saldo parcial da conta.",
  auth: {
    tipo: "OAUTH2_CLIENT_CREDENTIALS",
    campos: [
      { key: "clientId", label: "Client ID", tipo: "text" },
      { key: "clientSecret", label: "Client Secret", tipo: "password" },
      {
        key: "developerApplicationKey",
        label: "Developer Application Key",
        tipo: "password",
        ajuda: "Cabeçalho gw-dev-app-key do portal BB",
      },
      { key: "agencia", label: "Agência", tipo: "text" },
      { key: "conta", label: "Conta", tipo: "text" },
    ],
  },
  capacidades: ["extrato", "saldo"],
  ambientes: ["sandbox", "producao"],
  disponivel: false,
  preRequisito:
    "A aplicação nasce em sandbox; liberar produção passa pelo gerente da conta.",
};

export const itau: ProviderManifest = {
  id: "itau",
  nome: "Itaú",
  categoria: "BANCO",
  logo: "/integracoes/itau.svg",
  cor: "#EC7000",
  resumo: "Extrato e Cash Management pelas APIs do Itaú.",
  auth: {
    tipo: "OAUTH2_CLIENT_CREDENTIALS",
    mtls: true,
    campos: [
      { key: "clientId", label: "Client ID", tipo: "text" },
      { key: "clientSecret", label: "Client Secret", tipo: "password" },
      ...certificadoMtls,
    ],
  },
  capacidades: ["extrato", "saldo"],
  ambientes: ["sandbox", "producao"],
  disponivel: false,
  preRequisito:
    "Cash Management tem credencial própria, e o certificado dinâmico vence e exige reemissão.",
};

export const santander: ProviderManifest = {
  id: "santander",
  nome: "Santander",
  categoria: "BANCO",
  logo: "/integracoes/santander.svg",
  cor: "#EC0000",
  resumo: "Extrato e saldos pela API do Santander Empresas.",
  auth: {
    tipo: "OAUTH2_CLIENT_CREDENTIALS",
    mtls: true,
    campos: [
      { key: "clientId", label: "Client ID", tipo: "text" },
      { key: "clientSecret", label: "Client Secret", tipo: "password" },
      ...certificadoMtls,
    ],
  },
  capacidades: ["extrato", "saldo"],
  ambientes: ["sandbox", "producao"],
  disponivel: false,
  preRequisito:
    "Certificado x509 v3 PEM com Key Usage 'digital signature', de certificadora autorizada.",
};

export const bradesco: ProviderManifest = {
  id: "bradesco",
  nome: "Bradesco",
  categoria: "BANCO",
  logo: "/integracoes/bradesco.svg",
  cor: "#CC092F",
  resumo: "Cobrança e extrato pela API do Bradesco.",
  auth: {
    tipo: "OAUTH2_CLIENT_CREDENTIALS",
    mtls: true,
    campos: [
      { key: "clientId", label: "Client ID", tipo: "text" },
      ...certificadoMtls,
    ],
  },
  capacidades: ["extrato"],
  ambientes: ["producao"],
  disponivel: false,
  preRequisito:
    "O Client ID é solicitado por e-mail ao banco (suporte.api@bradesco.com.br) — não há autosserviço.",
};

export const caixa: ProviderManifest = {
  id: "caixa",
  nome: "Caixa",
  categoria: "BANCO",
  logo: "/integracoes/caixa.svg",
  cor: "#005CA9",
  resumo: "Extrato por arquivo CNAB240.",
  auth: {
    tipo: "ARQUIVO",
    formatos: ["CNAB240"],
    campos: [],
  },
  capacidades: ["extrato"],
  ambientes: ["producao"],
  disponivel: false,
  preRequisito:
    "A Caixa não tem portal de desenvolvedor; a integração é por arquivo ou ativação de WebService junto ao banco.",
};

export const bancos: ProviderManifest[] = [
  inter,
  sicoob,
  sicredi,
  bancoDoBrasil,
  itau,
  santander,
  bradesco,
  caixa,
];
