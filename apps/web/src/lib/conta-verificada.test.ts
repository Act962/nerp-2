import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("./auth", () => ({ auth: { api: {} } }));

const orgs = new Map<string, { verifiedAt: Date | null }>();
vi.mock("./db", () => ({
  default: {
    organization: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        orgs.get(where.id) ?? null,
    },
  },
}));

const { contaVerificada, exigirContaVerificada, ContaNaoVerificadaError } =
  await import("./conta-verificada");

describe("contaVerificada", () => {
  it("nula → sandbox; preenchida → verificada; inexistente → não", async () => {
    orgs.set("a", { verifiedAt: null });
    orgs.set("b", { verifiedAt: new Date() });
    expect(await contaVerificada("a")).toBe(false);
    expect(await contaVerificada("b")).toBe(true);
    expect(await contaVerificada("x")).toBe(false);
  });

  it("exigir lança FORBIDDEN com o código que o cliente reconhece", async () => {
    orgs.set("a", { verifiedAt: null });
    const erro = await exigirContaVerificada("a", "convidar alguém").catch(
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(ContaNaoVerificadaError);
    expect((erro as InstanceType<typeof ContaNaoVerificadaError>).data).toEqual(
      {
        code: "CONTA_NAO_VERIFICADA",
        motivo: "convidar alguém",
      },
    );
    orgs.set("b", { verifiedAt: new Date() });
    await expect(exigirContaVerificada("b", "x")).resolves.toBeUndefined();
  });
});
