import { describe, expect, it, vi } from "vitest";
import { pingFocus } from "./focus-nfe";

vi.mock("server-only", () => ({}));

const resposta = (status: number, corpo: unknown) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  ) as unknown as typeof fetch;

describe("pingFocus", () => {
  it("token da empresa válido: a nota inexistente volta nao_encontrado", async () => {
    const fetch = resposta(404, {
      codigo: "nao_encontrado",
      mensagem: "Nota fiscal não encontrada",
    });
    const r = await pingFocus("HOMOLOGACAO", "tok", { fetch });
    expect(r.ok).toBe(true);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "https://homologacao.focusnfe.com.br/v2/nfce/nerp-ping-token",
    );
  });

  it("token inválido: 401 permissao_negada", async () => {
    const r = await pingFocus("PRODUCAO", "tok", {
      fetch: resposta(401, { codigo: "permissao_negada" }),
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Token inválido/);
  });

  it("404 sem o código da Focus não conta como sucesso", async () => {
    const r = await pingFocus("HOMOLOGACAO", "tok", {
      fetch: resposta(404, { status: 404, error: "Not Found" }),
    });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Provedor respondeu 404");
  });

  it("sem token não chama a rede", async () => {
    const fetch = resposta(404, {});
    const r = await pingFocus("HOMOLOGACAO", "", { fetch });
    expect(r.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falha de rede vira mensagem, não exceção", async () => {
    const semRede = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const r = await pingFocus("HOMOLOGACAO", "tok", { fetch: semRede });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(0);
  });
});
