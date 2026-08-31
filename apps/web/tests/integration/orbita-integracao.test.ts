import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orbitaRevoke } from "@/app/router/integracoes/orbita/revoke";
import { orbitaStatus } from "@/app/router/integracoes/orbita/status";
import type { Organization, User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * Conexão com o Órbita CRM.
 *
 * A chave que o Órbita usa para chamar o nerp é uma credencial de verdade — dá
 * acesso a produtos, estoque, clientes e vendas. Os testes fixam duas coisas:
 * ela **nunca** sai pela API, nem mascarada, e revogar não apaga o registro de
 * quem autorizou.
 */

const CHAVE = "nerp_live_chave_super_secreta_1234";
const SEGREDO_CIFRADO = "segredo-cifrado-de-teste";

let org: Organization;
let outraOrg: Organization;
let admin: User;
let comum: User;
let adminDaOutra: User;

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Rede com Órbita");
  outraOrg = await createOrg("Rede vizinha");
  admin = await createUser();
  comum = await createUser();
  adminDaOutra = await createUser();

  await createMember(admin, org);
  await createMember(adminDaOutra, outraOrg);
  await prisma.member.create({
    data: { organizationId: org.id, userId: comum.id, role: "member" },
  });

  await prisma.nasaIntegrationKey.create({
    data: {
      organizationId: org.id,
      apiKey: CHAVE,
      secretCiphertext: SEGREDO_CIFRADO,
      scopes: ["products:rw", "sales:rw", "customer:rw"],
      consentByUserId: admin.id,
      lastUsedAt: new Date(),
    },
  });
});

afterAll(resetDb);

describe("integracoes.orbita.status", () => {
  it("mostra quem autorizou, quando e com quais permissões", async () => {
    const resultado = await call(
      orbitaStatus,
      {},
      { context: s2sContext(admin, org) },
    );

    expect(resultado.conexao).not.toBeNull();
    expect(resultado.conexao?.autorizadaPor).toBe(admin.name);
    expect(resultado.conexao?.permissoes).toContain("sales:rw");
    expect(resultado.conexao?.ultimoUso).not.toBeNull();
  });

  it("nunca devolve a chave nem o segredo", async () => {
    const resultado = await call(
      orbitaStatus,
      {},
      { context: s2sContext(admin, org) },
    );
    const serializado = JSON.stringify(resultado);

    // Nem mascarados: diferente de uma credencial digitada pelo operador,
    // esta ele nunca viu e nunca vai precisar conferir.
    expect(serializado).not.toContain(CHAVE);
    expect(serializado).not.toContain(SEGREDO_CIFRADO);
    expect(serializado).not.toContain("nerp_live");
  });

  it("não enxerga a conexão de outra organização", async () => {
    const resultado = await call(
      orbitaStatus,
      {},
      { context: s2sContext(adminDaOutra, outraOrg) },
    );
    expect(resultado.conexao).toBeNull();
  });

  it("membro comum vê o estado mas não pode gerenciar", async () => {
    const resultado = await call(
      orbitaStatus,
      {},
      { context: s2sContext(comum, org) },
    );
    expect(resultado.conexao).not.toBeNull();
    expect(resultado.podeGerenciar).toBe(false);
  });
});

describe("integracoes.orbita.revoke", () => {
  it("recusa quem não é administrador", async () => {
    await expect(
      call(orbitaRevoke, {}, { context: s2sContext(comum, org) }),
    ).rejects.toThrow(/administradores/i);
  });

  it("não alcança a chave de outra organização", async () => {
    const resultado = await call(
      orbitaRevoke,
      {},
      { context: s2sContext(adminDaOutra, outraOrg) },
    );
    expect(resultado.revogadas).toBe(0);

    // E a chave da outra continua ativa.
    const ativa = await prisma.nasaIntegrationKey.count({
      where: { organizationId: org.id, revokedAt: null },
    });
    expect(ativa).toBe(1);
  });

  it("revoga marcando a data, sem apagar quem autorizou", async () => {
    const resultado = await call(
      orbitaRevoke,
      {},
      { context: s2sContext(admin, org) },
    );
    expect(resultado.revogadas).toBe(1);

    const chave = await prisma.nasaIntegrationKey.findFirstOrThrow({
      where: { organizationId: org.id },
    });
    expect(chave.revokedAt).not.toBeNull();
    // Apagar a linha levaria junto o registro de quem autorizou e quando — que
    // é justamente o que se quer consultar depois de revogar.
    expect(chave.consentByUserId).toBe(admin.id);

    const depois = await call(
      orbitaStatus,
      {},
      { context: s2sContext(admin, org) },
    );
    expect(depois.conexao).toBeNull();
  });
});
