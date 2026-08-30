import type { ProviderManifest } from "./types";

// Nas adquirentes a credencial de e-commerce (transacionar) é fácil de obter; o
// que quase nenhuma libera para o lojista é LER a venda liquidada. Por isso
// `capacidades` aqui fala de recebíveis/taxas, e vários provedores entram como
// arquivo ou com pré-requisito comercial explícito.

export const pagbank: ProviderManifest = {
  id: "pagbank",
  nome: "PagBank",
  categoria: "ADQUIRENTE",
  logo: "/integracoes/pagbank.svg",
  cor: "#00A868",
  resumo: "Extrato EDI em JSON: movimento transacional, financeiro e saldos.",
  auth: {
    tipo: "API_KEY",
    campos: [
      {
        key: "user",
        label: "Estabelecimento",
        tipo: "text",
        ajuda: "Número do estabelecimento usado como USER na API EDI",
      },
      {
        key: "token",
        label: "Token da API EDI",
        tipo: "password",
        ajuda: "Solicitado no portal do desenvolvedor PagBank",
      },
    ],
  },
  capacidades: ["recebiveis", "taxas", "saldo"],
  ambientes: ["producao"],
  disponivel: false,
  preRequisito:
    "O dado só fica íntegro em D+1 — a conciliação do dia corrente sempre vem parcial.",
  docsUrl: "https://developer.pagbank.com.br/docs/api-do-extrato-edi",
};

export const mercadoPago: ProviderManifest = {
  id: "mercado-pago",
  nome: "Mercado Pago",
  categoria: "ADQUIRENTE",
  logo: "/integracoes/mercado-pago.svg",
  cor: "#00B1EA",
  resumo: "Relatório de liberações (settlement) por período.",
  auth: {
    tipo: "API_KEY",
    campos: [
      {
        key: "accessToken",
        label: "Access Token",
        tipo: "password",
        ajuda: "Painel do desenvolvedor → suas integrações → credenciais",
      },
    ],
  },
  capacidades: ["recebiveis", "taxas"],
  ambientes: ["sandbox", "producao"],
  disponivel: false,
};

export const cielo: ProviderManifest = {
  id: "cielo",
  nome: "Cielo",
  categoria: "ADQUIRENTE",
  logo: "/integracoes/cielo.svg",
  cor: "#00AEEF",
  resumo: "Conciliação pelo arquivo do Extrato Eletrônico (EDI).",
  auth: {
    tipo: "ARQUIVO",
    formatos: ["EDI"],
    campos: [],
  },
  capacidades: ["recebiveis", "taxas"],
  ambientes: ["producao"],
  disponivel: false,
  preRequisito:
    "A Cielo entrega conciliação por arquivo baixado do site, não por API do lojista.",
  docsUrl: "https://developercielo.github.io/tutorial/edi-extrato-eletronico",
};

export const rede: ProviderManifest = {
  id: "rede",
  nome: "Rede",
  categoria: "ADQUIRENTE",
  logo: "/integracoes/rede.svg",
  cor: "#F47920",
  resumo: "Conciliação pelo arquivo EDI da Rede.",
  auth: {
    tipo: "ARQUIVO",
    formatos: ["EDI"],
    campos: [],
  },
  capacidades: ["recebiveis", "taxas"],
  ambientes: ["producao"],
  disponivel: false,
  preRequisito:
    "A API EDI da Rede é exclusiva de empresas conciliadoras; o lojista recebe o arquivo.",
};

export const stone: ProviderManifest = {
  id: "stone",
  nome: "Stone",
  categoria: "ADQUIRENTE",
  logo: "/integracoes/stone.svg",
  cor: "#00A868",
  resumo: "Conciliação de transações e eventos financeiros.",
  auth: {
    tipo: "API_KEY",
    campos: [
      {
        key: "clientApplicationKey",
        label: "Client Application Key",
        tipo: "password",
      },
      { key: "secretKey", label: "Secret Key", tipo: "password" },
    ],
  },
  capacidades: ["recebiveis", "taxas"],
  ambientes: ["producao"],
  disponivel: false,
  preRequisito:
    "A API de Conciliação exige cadastro aprovado no canal de Parcerias da Stone, e não tem sandbox.",
};

export const getnet: ProviderManifest = {
  id: "getnet",
  nome: "Getnet",
  categoria: "ADQUIRENTE",
  logo: "/integracoes/getnet.svg",
  cor: "#FF7100",
  resumo: "Extrato de vendas e recebíveis da Getnet.",
  auth: {
    tipo: "OAUTH2_CLIENT_CREDENTIALS",
    campos: [
      {
        key: "sellerId",
        label: "Seller ID",
        tipo: "text",
        ajuda: "Painel Getnet → Configurações → Identificação API",
      },
      { key: "clientId", label: "Client ID", tipo: "text" },
      { key: "clientSecret", label: "Client Secret", tipo: "password" },
    ],
  },
  capacidades: ["recebiveis", "taxas"],
  ambientes: ["sandbox", "producao"],
  disponivel: false,
  preRequisito:
    "Extrato de vendas e recebíveis não fazem parte da API de pagamentos — são os produtos Extrato Eletrônico e Conciliação, contratados à parte.",
};

export const adquirentes: ProviderManifest[] = [
  pagbank,
  mercadoPago,
  cielo,
  rede,
  stone,
  getnet,
];
