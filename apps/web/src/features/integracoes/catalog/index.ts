import type { IntegrationCategory } from "@/generated/prisma/enums";
import { adquirentes } from "./adquirentes";
import { bancos } from "./bancos";
import { crms } from "./crms";
import { nativos } from "./nativos";
import type { CredentialField, ProviderManifest } from "./types";

export const CATALOGO: ProviderManifest[] = [
  ...bancos,
  ...adquirentes,
  ...crms,
  ...nativos,
];

// Dois manifestos com o mesmo id disputariam a mesma linha de
// `FinancialIntegration` (a unique é organizationId+providerId+externalRef) —
// erro de programação que só apareceria como dado trocado. Falha no import.
const idsDuplicados = CATALOGO.map((p) => p.id).filter(
  (id, i, todos) => todos.indexOf(id) !== i,
);
if (idsDuplicados.length > 0) {
  throw new Error(
    `Catálogo de integrações com id repetido: ${idsDuplicados.join(", ")}`,
  );
}

const PROVIDERS = new Map(CATALOGO.map((p) => [p.id, p]));

export function getManifest(id: string): ProviderManifest | undefined {
  return PROVIDERS.get(id);
}

/** Para o servidor, onde provedor desconhecido é entrada inválida, não estado. */
export function requireManifest(id: string): ProviderManifest {
  const manifest = PROVIDERS.get(id);
  if (!manifest) {
    throw new Error(`Provedor de integração desconhecido: ${id}`);
  }
  return manifest;
}

// Ordem das seções na tela. Banco e adquirente primeiro — é o que o catálogo
// veio resolver; as três que já existiam ficam no fim.
export const SECOES: {
  categoria: IntegrationCategory;
  titulo: string;
  descricao: string;
}[] = [
  {
    categoria: "BANCO",
    titulo: "Bancos",
    descricao: "Extrato e saldo da conta, para a conciliação bancária.",
  },
  {
    categoria: "ADQUIRENTE",
    titulo: "Adquirentes",
    descricao: "Vendas liquidadas, taxas e recebíveis das maquininhas.",
  },
  {
    categoria: "GATEWAY",
    titulo: "Gateways de pagamento",
    descricao: "Cobrança por PIX, boleto e cartão.",
  },
  {
    categoria: "CRM",
    titulo: "CRMs",
    descricao: "Atendimento e funil de vendas em outra plataforma.",
  },
  {
    categoria: "ERP",
    titulo: "ERP",
    descricao: "Espelho de vendas e cadastro vindos de um ERP externo.",
  },
  {
    categoria: "FISCAL",
    titulo: "Fiscal",
    descricao: "Emissão de nota pelo provedor.",
  },
  {
    categoria: "PRODUTIVIDADE",
    titulo: "Produtividade",
    descricao: "Arquivos e planilhas.",
  },
];

export function manifestosDaCategoria(
  categoria: IntegrationCategory,
): ProviderManifest[] {
  return CATALOGO.filter((p) => p.categoria === categoria);
}

/**
 * Campo cujo valor nunca volta para o client — e que, em branco no formulário,
 * significa "mantém o que já está guardado".
 */
export function ehSegredo(tipo: CredentialField["tipo"]): boolean {
  return tipo === "password" || tipo === "file";
}

export type { ProviderManifest, CredentialField, Capacidade } from "./types";
