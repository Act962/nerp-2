import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `/api/s3/delete` só apaga o que é da organização ativa. O Better Auth e o
 * cliente S3 são dublados: o que se testa é a decisão, não a rede.
 */

const dublagem: {
  sessao: { user: { id: string } } | null;
  org: { id: string } | null;
} = { sessao: null, org: null };

const enviar = vi.fn(async () => ({}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => dublagem.sessao),
      getFullOrganization: vi.fn(async () => dublagem.org),
    },
  },
}));
vi.mock("@/lib/s3-client", () => ({ S3: { send: enviar } }));

const { DELETE } = await import("@/app/api/s3/delete/route");
const { createMember, createOrg, createUser, resetDb } = await import(
  "./helpers"
);

type Org = Awaited<ReturnType<typeof createOrg>>;
type Usuario = Awaited<ReturnType<typeof createUser>>;

let orgA: Org;
let orgB: Org;
let dono: Usuario;

const pedido = (key: string) =>
  new Request("http://localhost/api/s3/delete", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  });

beforeAll(async () => {
  await resetDb();
  orgA = await createOrg("Org A");
  orgB = await createOrg("Org B");
  dono = await createUser();
  await createMember(dono, orgA);
});

afterAll(resetDb);

describe("DELETE /api/s3/delete", () => {
  it("sem sessão: 401", async () => {
    dublagem.sessao = null;
    const resposta = await DELETE(pedido(`${orgA.id}/x.png`));
    expect(resposta.status).toBe(401);
  });

  it("apaga chave da própria organização", async () => {
    dublagem.sessao = { user: { id: dono.id } };
    dublagem.org = { id: orgA.id };
    enviar.mockClear();
    const resposta = await DELETE(pedido(`${orgA.id}/foto.png`));
    expect(resposta.status).toBe(200);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("chave de outra organização: 403 e nada é enviado ao bucket", async () => {
    dublagem.sessao = { user: { id: dono.id } };
    dublagem.org = { id: orgA.id };
    enviar.mockClear();
    const resposta = await DELETE(pedido(`${orgB.id}/foto.png`));
    expect(resposta.status).toBe(403);
    expect(enviar).not.toHaveBeenCalled();
  });

  it("chave antiga que ninguém referencia: 403", async () => {
    dublagem.sessao = { user: { id: dono.id } };
    dublagem.org = { id: orgA.id };
    enviar.mockClear();
    const resposta = await DELETE(pedido("orfa.png"));
    expect(resposta.status).toBe(403);
    expect(enviar).not.toHaveBeenCalled();
  });
});
