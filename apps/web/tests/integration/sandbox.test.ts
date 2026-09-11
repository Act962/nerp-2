import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvitation } from "@/app/router/invitation/create";
import { createCheckout } from "@/app/router/stars/create-checkout";
import { criarSandbox } from "@/features/onboarding/server/criar-sandbox";
import {
  apagarSandboxExpirada,
  avisarSandboxes,
  listarSandboxesExpiradas,
} from "@/features/onboarding/server/expirar-sandbox";
import { vincularContaAnonima } from "@/features/onboarding/server/vincular-conta";
import type { User } from "@/generated/prisma/client";
import prisma from "@/lib/db";
import { createUser, resetDb, s2sContext } from "./helpers";

/**
 * A sandbox: nasce em um clique, não sai para o mundo, vira de verdade no
 * vínculo com o Google, e some depois de 30 dias sem acesso.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

let anonimo: User;
let organizationId: string;

async function criarAnonimo(): Promise<User> {
  const user = await createUser();
  return prisma.user.update({
    where: { id: user.id },
    data: { isAnonymous: true, name: "Visitante" },
  });
}

beforeAll(async () => {
  await resetDb();
  anonimo = await criarAnonimo();
  const criada = await criarSandbox({
    userId: anonimo.id,
    respostas: {
      nicho: "supermercados",
      segment: "VAREJO",
      interesses: ["pdv", "whatsapp"],
    },
  });
  organizationId = criada.organizationId;
});

afterAll(async () => {
  // As sandboxes têm slug `sandbox-…`, fora do `org-` que o resetDb limpa.
  await prisma.organization
    .findMany({
      where: { slug: { startsWith: "sandbox-" } },
      select: { id: true },
    })
    .then((orgs) =>
      Promise.all(
        orgs.map((o) =>
          import("@/features/organization/server/apagar-organizacao").then(
            (m) => m.apagarOrganizacao(o.id),
          ),
        ),
      ),
    );
  await resetDb();
});

describe("criarSandbox", () => {
  it("nasce sem subdomínio, sem verificação, com dono, 50 ★, nicho, interesses e exemplos", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(org.subdomain).toBeNull();
    expect(org.verifiedAt).toBeNull();
    expect(org.lastAccessAt).not.toBeNull();
    expect(org.starsBalance).toBe(50);
    expect(org.niche).toBe("supermercados");
    expect(org.interests).toEqual(["pdv", "whatsapp"]);
    expect(org.segment).toBe("VAREJO");

    const dono = await prisma.member.findFirstOrThrow({
      where: { organizationId, userId: anonimo.id },
    });
    expect(dono.role).toBe("owner");

    const [produtos, funis, eventos, vendas, cupons, metas] = await Promise.all(
      [
        prisma.product.count({ where: { organizationId, isDemo: true } }),
        prisma.crmFunnel.count({ where: { organizationId, isDemo: true } }),
        prisma.calendarEvent.count({ where: { organizationId, isDemo: true } }),
        prisma.sale.count({ where: { organizationId, isDemo: true } }),
        prisma.receiptTemplate.count({
          where: { organizationId, isDemo: true },
        }),
        prisma.salesGoalPeriod.count({
          where: { organizationId, isDemo: true },
        }),
      ],
    );
    expect(produtos).toBe(10);
    expect(funis).toBe(1);
    expect(eventos).toBe(3);
    expect(vendas).toBe(2);
    expect(cupons).toBe(1);
    expect(metas).toBe(1);
  });

  it("é idempotente por usuário", async () => {
    const segunda = await criarSandbox({ userId: anonimo.id });
    expect(segunda.criou).toBe(false);
    expect(segunda.organizationId).toBe(organizationId);
  });
});

describe("gate de conta verificada", () => {
  it("convidar e comprar Stars são recusados com CONTA_NAO_VERIFICADA", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    const ctx = { context: s2sContext(anonimo, org) };
    const erroConvite = await call(
      createInvitation,
      { emails: ["a@b.com"], role: "member", permissions: [], tradeRole: null },
      ctx,
    ).catch((e: unknown) => e);
    expect(erroConvite).toMatchObject({
      code: "FORBIDDEN",
      data: { code: "CONTA_NAO_VERIFICADA" },
    });
    const erroCompra = await call(
      createCheckout,
      { packageId: "x" },
      ctx,
    ).catch((e: unknown) => e);
    expect(erroCompra).toMatchObject({
      data: { code: "CONTA_NAO_VERIFICADA" },
    });
  });
});

describe("vincularContaAnonima", () => {
  it("move a organização para a conta nova, verifica, dá subdomínio e preserva o histórico", async () => {
    const novo = await createUser();
    const produtoAntes = await prisma.product.findFirstOrThrow({
      where: { organizationId },
      select: { id: true, createdById: true },
    });

    const resultado = await vincularContaAnonima({
      anonimoId: anonimo.id,
      novoId: novo.id,
    });
    expect(resultado.organizationIds).toEqual([organizationId]);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });
    expect(org.verifiedAt).not.toBeNull();
    expect(org.subdomain).toBe(org.slug);

    const membros = await prisma.member.findMany({ where: { organizationId } });
    expect(membros.map((m) => m.userId)).toEqual([novo.id]);

    const produtoDepois = await prisma.product.findUniqueOrThrow({
      where: { id: produtoAntes.id },
      select: { createdById: true },
    });
    expect(produtoDepois.createdById).toBe(anonimo.id);

    const provisoria = await prisma.user.findUniqueOrThrow({
      where: { id: anonimo.id },
    });
    expect(provisoria.linkedToUserId).toBe(novo.id);

    // Agora convidar passa.
    const ctx = { context: s2sContext(novo, org) };
    await expect(
      call(
        createInvitation,
        { emails: [], role: "member", permissions: [], tradeRole: null },
        ctx,
      ),
    ).rejects.not.toMatchObject({ data: { code: "CONTA_NAO_VERIFICADA" } });
  });

  it("se o e-mail já era membro, o membro provisório some e não duplica", async () => {
    const outroAnonimo = await criarAnonimo();
    const { organizationId: outraOrg } = await criarSandbox({
      userId: outroAnonimo.id,
    });
    const existente = await createUser();
    await prisma.member.create({
      data: { organizationId: outraOrg, userId: existente.id, role: "member" },
    });
    await vincularContaAnonima({
      anonimoId: outroAnonimo.id,
      novoId: existente.id,
    });
    const membros = await prisma.member.findMany({
      where: { organizationId: outraOrg },
    });
    expect(membros).toHaveLength(1);
    expect(membros[0]?.userId).toBe(existente.id);
  });
});

describe("expiração", () => {
  it("avisa aos 23 dias e apaga aos 30, ignorando organização verificada", async () => {
    const dono = await criarAnonimo();
    const { organizationId: sandbox } = await criarSandbox({ userId: dono.id });
    const agora = new Date();
    await prisma.organization.update({
      where: { id: sandbox },
      data: { lastAccessAt: new Date(agora.getTime() - 24 * DIA_MS) },
    });

    expect(await avisarSandboxes(agora)).toBeGreaterThanOrEqual(1);
    const avisada = await prisma.organization.findUniqueOrThrow({
      where: { id: sandbox },
    });
    expect(avisada.expiryWarnedAt).not.toBeNull();
    expect(await avisarSandboxes(agora)).toBe(0);

    expect(
      (await listarSandboxesExpiradas(agora)).map((o) => o.id),
    ).not.toContain(sandbox);
    expect(await apagarSandboxExpirada(sandbox, agora)).toBe(false);

    const daqui31 = new Date(agora.getTime() + 7 * DIA_MS);
    expect(
      (await listarSandboxesExpiradas(daqui31)).map((o) => o.id),
    ).toContain(sandbox);
    expect(await apagarSandboxExpirada(sandbox, daqui31)).toBe(true);
    expect(
      await prisma.organization.findUnique({ where: { id: sandbox } }),
    ).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: dono.id } })).toBeNull();

    // A verificada (vinculada acima) nunca entra na lista.
    expect(
      (await listarSandboxesExpiradas(daqui31)).map((o) => o.id),
    ).not.toContain(organizationId);
  });
});
