import { createHmac } from "node:crypto";

/**
 * Assinatura das chamadas NERP → Órbita. É o espelho exato do que
 * `nasa-s2s-verify.ts` confere na direção contrária: HMAC-SHA256 em hex sobre
 * `MÉTODO\nPATH\nCORPO\nTIMESTAMP`, com o segredo da `NasaIntegrationKey`.
 * O corpo enviado tem de ser byte a byte a string assinada.
 */

export const ORBITA_ORDERS_PATH = "/api/integrations/nerp/orders";

export type SignOrbitaRequestInput = {
  secret: string;
  method: string;
  path: string;
  body: string;
  timestamp: string;
};

export function signOrbitaRequest(input: SignOrbitaRequestInput): string {
  const canonical = `${input.method.toUpperCase()}\n${input.path}\n${input.body}\n${input.timestamp}`;
  return createHmac("sha256", input.secret).update(canonical).digest("hex");
}

export type BuildOrbitaHeadersInput = {
  apiKey: string;
  organizationId: string;
  secret: string;
  body: string;
  timestamp: string;
};

export function buildOrbitaOrderHeaders(
  input: BuildOrbitaHeadersInput,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Nerp-Api-Key": input.apiKey,
    "X-Nerp-Org-Id": input.organizationId,
    "X-Nerp-Timestamp": input.timestamp,
    "X-Nerp-Signature": signOrbitaRequest({
      secret: input.secret,
      method: "POST",
      path: ORBITA_ORDERS_PATH,
      body: input.body,
      timestamp: input.timestamp,
    }),
  };
}
