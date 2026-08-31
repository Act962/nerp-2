import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listIntegracoes } from "@/app/router/integracoes/list";
import { removeIntegracao } from "@/app/router/integracoes/remove";
import { setProviderLogo } from "@/app/router/integracoes/set-provider-logo";
import type { Organization, User } from "@/generated/prisma/client";
import { cifrarCredenciais } from "@/features/integracoes/server/credentials";
import prisma from "@/lib/db";
import {
  createMember,
  createOrg,
  createUser,
  resetDb,
  s2sContext,
} from "./helpers";

/**
 * Integração guarda credencial de banco de um cliente: um `findMany` sem
 * `organizationId` aqui não vaza só um nome de fornecedor, vaza o acesso à
 * conta. Por isso o isolamento é testado nas duas pontas — o que a listagem
 * devolve e o que a remoção alcança.
 */
describe("integracoes", () => {
  let orgA: Organization;
  let orgB: Organization;
  let ownerA: User;
  let membroComumA: User;
  let integracaoDaB: string;

  beforeAll(async () => {
    await resetDb();

    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    ownerA = await createUser();
    await createMember(ownerA, orgA);

    membroComumA = await createUser();
    await prisma.member.create({
      data: {
        organizationId: orgA.id,
        userId: membroComumA.id,
        role: "member",
      },
    });

    const ownerB = await createUser();
    await createMember(ownerB, orgB);

    await prisma.financialIntegration.create({
      data: {
        organizationId: orgA.id,
        providerId: "inter",
        category: "BANCO",
        installedById: ownerA.id,
        displayName: "Inter da A",
        credentialsCiphertext: cifrarCredenciais({
          clientId: "id-publico-da-A",
          clientSecret: "segredo-da-A-1234",
        }),
      },
    });

    const daB = await prisma.financialIntegration.create({
      data: {
        organizationId: orgB.id,
        providerId: "inter",
        category: "BANCO",
        installedById: ownerB.id,
        displayName: "Inter da B",
        credentialsCiphertext: cifrarCredenciais({
          clientId: "id-publico-da-B",
          clientSecret: "segredo-da-B-1234",
        }),
      },
    });
    integracaoDaB = daB.id;
  });

  afterAll(resetDb);

  it("devolve só as integrações da organização do contexto", async () => {
    const result = await call(
      listIntegracoes,
      {},
      { context: s2sContext(ownerA, orgA) },
    );

    expect(result.instalacoes.map((i) => i.displayName)).toEqual([
      "Inter da A",
    ]);
  });

  it("nunca devolve segredo em texto claro", async () => {
    const result = await call(
      listIntegracoes,
      {},
      { context: s2sContext(ownerA, orgA) },
    );

    const serializado = JSON.stringify(result);
    expect(serializado).not.toContain("segredo-da-A-1234");
    // Campo de texto volta preenchido para editar sem redigitar; segredo, não.
    expect(result.instalacoes[0].valores.clientId).toBe("id-publico-da-A");
    expect(result.instalacoes[0].valores.clientSecret).toBe("••••1234");
  });

  it("membro comum vê o catálogo mas não recebe credencial nem gerencia", async () => {
    const result = await call(
      listIntegracoes,
      {},
      { context: s2sContext(membroComumA, orgA) },
    );

    expect(result.podeGerenciar).toBe(false);
    expect(result.instalacoes[0].valores).toEqual({});

    await expect(
      call(
        removeIntegracao,
        { id: integracaoDaB },
        { context: s2sContext(membroComumA, orgA) },
      ),
    ).rejects.toThrow();
  });

  it("logo de provedor é global e só o super-admin escreve", async () => {
    // `ownerA` é dono da organização e ainda assim não passa: a logo vale para
    // todos os inquilinos, então o portão é o super-admin do sistema.
    await expect(
      call(
        setProviderLogo,
        { providerId: "inter", logoKey: "logos/inter.png" },
        { context: s2sContext(ownerA, orgA) },
      ),
    ).rejects.toThrow();

    expect(await prisma.integrationProviderLogo.count()).toBe(0);
  });

  it("recusa URL solta como logo, só chave do R2", async () => {
    await expect(
      call(
        setProviderLogo,
        { providerId: "inter", logoKey: "https://exemplo.com/logo.png" },
        { context: s2sContext(ownerA, orgA) },
      ),
    ).rejects.toThrow();
  });

  it("não remove integração de outra organização mesmo com o id certo", async () => {
    await expect(
      call(
        removeIntegracao,
        { id: integracaoDaB },
        { context: s2sContext(ownerA, orgA) },
      ),
    ).rejects.toThrow();

    const aindaExiste = await prisma.financialIntegration.findUnique({
      where: { id: integracaoDaB },
      select: { id: true },
    });
    expect(aindaExiste).not.toBeNull();
  });
});
