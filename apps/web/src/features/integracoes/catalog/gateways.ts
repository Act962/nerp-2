import type { ProviderManifest } from "./types";

// Gateway é diferente de adquirente: aqui a credencial COBRA, não só lê
// recebível. Por isso o campo é `password` e o webhook ganha segredo próprio —
// quem tiver a chave move dinheiro da loja.

export const asaas: ProviderManifest = {
  id: "asaas",
  nome: "Asaas",
  categoria: "GATEWAY",
  logo: null,
  cor: "#1D4ED8",
  resumo:
    "Cobrança por PIX com QR e copia-e-cola. É o que permite o cliente pagar pelo cardápio antes de o pedido ir para a cozinha.",
  auth: {
    tipo: "API_KEY",
    campos: [
      {
        key: "apiKey",
        label: "Chave de API",
        tipo: "password",
        ajuda: "Asaas → Configurações → Integrações → Gerar token",
      },
      {
        key: "webhookSecret",
        label: "Segredo do webhook",
        tipo: "password",
        opcional: true,
        ajuda:
          "Asaas → Configurações → Webhooks → Token de autenticação. Sem ele, o aviso de pagamento é recusado.",
      },
    ],
  },
  capacidades: ["cobranca"],
  ambientes: ["sandbox", "producao"],
  disponivel: true,
  docsUrl: "https://docs.asaas.com",
};

export const gateways: ProviderManifest[] = [asaas];
