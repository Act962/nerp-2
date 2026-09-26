import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildOrbitaOrderHeaders,
  ORBITA_ORDERS_PATH,
  signOrbitaRequest,
} from "./sign";

describe("assinatura NERP → Órbita", () => {
  const secret = "segredo-de-teste";
  const body = JSON.stringify({ nerpSaleId: "venda-1", saleNumber: 42 });
  const timestamp = "1790000000000";

  it("assina MÉTODO\\nPATH\\nCORPO\\nTIMESTAMP em HMAC-SHA256 hex", () => {
    const expected = createHmac("sha256", secret)
      .update(`POST\n${ORBITA_ORDERS_PATH}\n${body}\n${timestamp}`)
      .digest("hex");

    expect(
      signOrbitaRequest({
        secret,
        method: "post",
        path: ORBITA_ORDERS_PATH,
        body,
        timestamp,
      }),
    ).toBe(expected);
  });

  it("muda a assinatura quando qualquer byte do corpo muda", () => {
    const original = signOrbitaRequest({
      secret,
      method: "POST",
      path: ORBITA_ORDERS_PATH,
      body,
      timestamp,
    });
    const adulterada = signOrbitaRequest({
      secret,
      method: "POST",
      path: ORBITA_ORDERS_PATH,
      body: body.replace("42", "43"),
      timestamp,
    });
    expect(adulterada).not.toBe(original);
  });

  it("monta os cabeçalhos do contrato", () => {
    const headers = buildOrbitaOrderHeaders({
      apiKey: "nerp_key",
      organizationId: "org-1",
      secret,
      body,
      timestamp,
    });

    expect(headers).toEqual({
      "Content-Type": "application/json",
      "X-Nerp-Api-Key": "nerp_key",
      "X-Nerp-Org-Id": "org-1",
      "X-Nerp-Timestamp": timestamp,
      "X-Nerp-Signature": signOrbitaRequest({
        secret,
        method: "POST",
        path: ORBITA_ORDERS_PATH,
        body,
        timestamp,
      }),
    });
    expect(headers["X-Nerp-Signature"]).toMatch(/^[0-9a-f]{64}$/);
  });
});
