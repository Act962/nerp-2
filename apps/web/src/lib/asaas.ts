import "server-only";

/**
 * Cliente REST do Asaas — PIX, boleto e cartão.
 *
 * Port do `nasaex-wey` (`src/lib/asaas.ts`), que já roda em produção lá. É
 * autocontido de propósito: só `fetch`, nenhum SDK, nenhuma dependência do
 * resto do app. Quem decide qual chave usar é quem chama — este arquivo não
 * conhece organização, banco nem sessão.
 *
 * Duas mudanças em relação ao original, ambas por causa de segredo:
 * a chave nunca entra na mensagem de erro (`sanitizarErro` faz a limpeza no
 * adaptador), e o `server-only` impede que um import descuidado arraste a
 * chamada — e a chave — para o pacote do navegador.
 *
 * Docs: https://docs.asaas.com
 */

export const ASAAS_BASE = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://sandbox.asaas.com/api/v3",
} as const;

export type AsaasEnv = keyof typeof ASAAS_BASE;

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

async function asaasFetch<T>(
  apiKey: string,
  env: AsaasEnv,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const resposta = await fetch(`${ASAAS_BASE[env]}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(options?.headers ?? {}),
    },
  });

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => ({}))) as {
      errors?: { description?: string }[];
    };
    throw new AsaasError(
      corpo.errors?.[0]?.description ?? `Erro ${resposta.status} do Asaas`,
      resposta.status,
    );
  }

  return resposta.json() as Promise<T>;
}

// --- Cliente -----------------------------------------------------------------

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
}

/**
 * O Asaas exige um cliente para pendurar a cobrança.
 *
 * Busca por e-mail antes de criar: sem isso, cada pedido do mesmo cliente
 * abriria um cadastro novo lá, e o histórico do Asaas viraria uma lista de
 * homônimos.
 */
export async function findOrCreateCustomer(
  apiKey: string,
  env: AsaasEnv,
  email: string,
  name: string,
  cpfCnpj?: string,
): Promise<AsaasCustomer> {
  const existentes = await asaasFetch<{ data: AsaasCustomer[] }>(
    apiKey,
    env,
    `/customers?email=${encodeURIComponent(email)}&limit=1`,
  );

  const primeiro = existentes.data[0];
  if (primeiro) return primeiro;

  return asaasFetch<AsaasCustomer>(apiKey, env, "/customers", {
    method: "POST",
    body: JSON.stringify({ name, email, ...(cpfCnpj ? { cpfCnpj } : {}) }),
  });
}

// --- Cobrança ----------------------------------------------------------------

export type AsaasBillingType = "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD";

export interface AsaasChargeInput {
  customerId: string;
  billingType: AsaasBillingType;
  /** Em reais, como 29.90 — o Asaas não trabalha em centavos. */
  value: number;
  /** AAAA-MM-DD. */
  dueDate: string;
  description: string;
  /** Nosso id da cobrança. É por ele que o webhook reencontra o pedido. */
  externalReference: string;
  callbackSuccessUrl?: string;
}

export interface AsaasCharge {
  id: string;
  status: string;
  value: number;
  invoiceUrl: string;
  bankSlipUrl: string | null;
  pixQrCodeId: string | null;
  externalReference: string;
}

export async function createCharge(
  apiKey: string,
  env: AsaasEnv,
  input: AsaasChargeInput,
): Promise<AsaasCharge> {
  return asaasFetch<AsaasCharge>(apiKey, env, "/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
      ...(input.callbackSuccessUrl
        ? { callback: { successUrl: input.callbackSuccessUrl } }
        : {}),
    }),
  });
}

export async function getCharge(
  apiKey: string,
  env: AsaasEnv,
  chargeId: string,
): Promise<AsaasCharge> {
  return asaasFetch<AsaasCharge>(apiKey, env, `/payments/${chargeId}`);
}

// --- PIX ---------------------------------------------------------------------

export interface AsaasPixQr {
  /** PNG em base64, sem o prefixo `data:`. */
  encodedImage: string;
  /** Copia-e-cola. */
  payload: string;
  expirationDate: string;
}

export async function getPixQrCode(
  apiKey: string,
  env: AsaasEnv,
  chargeId: string,
): Promise<AsaasPixQr> {
  return asaasFetch<AsaasPixQr>(apiKey, env, `/payments/${chargeId}/pixQrCode`);
}

/** AAAA-MM-DD daqui a N dias, no fuso local. */
export function dueDatePlus(days: number): string {
  const data = new Date();
  data.setDate(data.getDate() + days);
  return data.toISOString().slice(0, 10);
}
