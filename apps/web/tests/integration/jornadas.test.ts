import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { concluir } from "@/app/router/jornadas/concluir";
import { iniciar } from "@/app/router/jornadas/iniciar";
import { listar } from "@/app/router/jornadas/listar";
import { JORNADAS } from "@/features/jornadas/catalogo";
import { tempoMinimoDaJornada } from "@/features/jornadas/lib/tempo";
import { JORNADAS_CONFIG_KEY } from "@/features/jornadas/server/config";
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
 * As jornadas guiadas: quem ganha ★, quem não ganha, e o que o vizinho não vê.
 *
 * A regra que este arquivo protege é a da recompensa ÚNICA POR EMPRESA. Ela é
 * dinheiro: sem ela, uma empresa com dez membros recebe dez vezes pela mesma
 * jornada — e a trava é um índice parcial no banco, coisa que só um teste
 * contra Postgres de verdade exercita.
 */

const JORNADA = JORNADAS[0];
const MINIMO = tempoMinimoDaJornada(JORNADA);

/** Empurra o início para o passado: o servidor mede contra o relógio DELE. */
async function fingirQueComecouHa(
  organizationId: string,
  userId: string,
  ms: number,
) {
  await prisma.jornadaProgresso.update({
    where: {
      organizationId_userId_jornadaId: {
        organizationId,
        userId,
        jornadaId: JORNADA.id,
      },
    },
    data: { iniciadaEm: new Date(Date.now() - ms) },
  });
}

describe("jornadas", () => {
  let orgA: Organization;
  let orgB: Organization;
  let ana: User;
  let bruno: User;
  let clara: User;

  beforeAll(async () => {
    await resetDb();

    orgA = await createOrg("Rede A");
    orgB = await createOrg("Rede B");
    ana = await createUser();
    bruno = await createUser();
    clara = await createUser();
    await createMember(ana, orgA);
    await createMember(bruno, orgA);
    await createMember(clara, orgB);

    // Empresas verificadas: a sandbox tem regra própria, testada à parte.
    await prisma.organization.updateMany({
      where: { id: { in: [orgA.id, orgB.id] } },
      data: { verifiedAt: new Date() },
    });
  });

  beforeEach(async () => {
    await prisma.jornadaProgresso.deleteMany({});
    await prisma.starTransaction.deleteMany({});
    await prisma.siteSetting.deleteMany({
      where: { key: JORNADAS_CONFIG_KEY },
    });
    await prisma.organization.updateMany({
      where: { id: { in: [orgA.id, orgB.id] } },
      data: { starsBalance: 0, verifiedAt: new Date() },
    });
  });

  afterAll(resetDb);

  it("credita ★ na empresa e deixa rastro no extrato", async () => {
    await call(
      iniciar,
      { jornadaId: JORNADA.id },
      { context: s2sContext(ana, orgA) },
    );
    await fingirQueComecouHa(orgA.id, ana.id, MINIMO + 1000);

    const resultado = await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(ana, orgA) },
    );

    expect(resultado.motivo).toBe("creditada");
    expect(resultado.starsCreditadas).toBe(JORNADA.starsSugeridas);

    const lancamento = await prisma.starTransaction.findFirst({
      where: { organizationId: orgA.id, type: "JORNADA_REWARD" },
    });
    expect(lancamento).not.toBeNull();
    expect(Number(lancamento?.amount)).toBe(JORNADA.starsSugeridas);
    // O saldo resultante fica na linha: é o que permite auditar sem
    // reprocessar a soma inteira.
    expect(Number(lancamento?.balanceAfter)).toBe(JORNADA.starsSugeridas);
    expect(lancamento?.userId).toBe(ana.id);
  });

  it("o colega faz a mesma jornada e a empresa NÃO é paga duas vezes", async () => {
    for (const quem of [ana, bruno]) {
      await call(
        iniciar,
        { jornadaId: JORNADA.id },
        { context: s2sContext(quem, orgA) },
      );
      await fingirQueComecouHa(orgA.id, quem.id, MINIMO + 1000);
    }

    const daAna = await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(ana, orgA) },
    );
    const doBruno = await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(bruno, orgA) },
    );

    expect(daAna.motivo).toBe("creditada");
    expect(doBruno.motivo).toBe("ja_resgatada");
    expect(doBruno.starsCreditadas).toBe(0);
    expect(doBruno.resgatadaPor).toBe(ana.name);

    const lancamentos = await prisma.starTransaction.count({
      where: { organizationId: orgA.id, type: "JORNADA_REWARD" },
    });
    expect(lancamentos).toBe(1);

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgA.id },
      select: { starsBalance: true },
    });
    expect(Number(org.starsBalance)).toBe(JORNADA.starsSugeridas);
  });

  it("concluir rápido demais é recusado, e nada é creditado", async () => {
    await call(
      iniciar,
      { jornadaId: JORNADA.id },
      { context: s2sContext(ana, orgA) },
    );

    await expect(
      call(
        concluir,
        { jornadaId: JORNADA.id, apressos: 5, tempos: [] },
        { context: s2sContext(ana, orgA) },
      ),
    ).rejects.toThrow(/passo a passo/);

    const lancamentos = await prisma.starTransaction.count({
      where: { organizationId: orgA.id },
    });
    expect(lancamentos).toBe(0);
  });

  it("concluir sem ter começado não vale", async () => {
    await expect(
      call(
        concluir,
        { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
        { context: s2sContext(ana, orgA) },
      ),
    ).rejects.toThrow();
  });

  it("refazer a jornada não paga de novo", async () => {
    await call(
      iniciar,
      { jornadaId: JORNADA.id },
      { context: s2sContext(ana, orgA) },
    );
    await fingirQueComecouHa(orgA.id, ana.id, MINIMO + 1000);
    await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(ana, orgA) },
    );

    const denovo = await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(ana, orgA) },
    );

    expect(denovo.motivo).toBe("ja_concluida");
    expect(denovo.starsCreditadas).toBe(0);
  });

  it("jornada valendo zero conclui sem pagar", async () => {
    await prisma.siteSetting.create({
      data: {
        key: JORNADAS_CONFIG_KEY,
        value: {
          porJornada: { [JORNADA.id]: { stars: 0, ativa: true } },
          recompensarSandbox: true,
        },
      },
    });

    await call(
      iniciar,
      { jornadaId: JORNADA.id },
      { context: s2sContext(ana, orgA) },
    );
    await fingirQueComecouHa(orgA.id, ana.id, MINIMO + 1000);

    const resultado = await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(ana, orgA) },
    );

    expect(resultado.motivo).toBe("jornada_sem_stars");
    expect(resultado.starsCreditadas).toBe(0);
  });

  it("empresa de teste não ganha quando o admin desliga a recompensa", async () => {
    await prisma.siteSetting.create({
      data: {
        key: JORNADAS_CONFIG_KEY,
        value: { porJornada: {}, recompensarSandbox: false },
      },
    });
    await prisma.organization.update({
      where: { id: orgA.id },
      data: { verifiedAt: null },
    });

    await call(
      iniciar,
      { jornadaId: JORNADA.id },
      { context: s2sContext(ana, orgA) },
    );
    await fingirQueComecouHa(orgA.id, ana.id, MINIMO + 1000);

    const resultado = await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(ana, orgA) },
    );

    expect(resultado.motivo).toBe("org_nao_elegivel");
  });

  it("conta provisória nunca leva ★, mesmo com a sandbox recompensada", async () => {
    await prisma.user.update({
      where: { id: ana.id },
      data: { isAnonymous: true },
    });

    await call(
      iniciar,
      { jornadaId: JORNADA.id },
      { context: s2sContext(ana, orgA) },
    );
    await fingirQueComecouHa(orgA.id, ana.id, MINIMO + 1000);

    const resultado = await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(ana, orgA) },
    );

    expect(resultado.motivo).toBe("org_nao_elegivel");
    await prisma.user.update({
      where: { id: ana.id },
      data: { isAnonymous: false },
    });
  });

  it("uma empresa não enxerga o progresso da outra", async () => {
    await call(
      iniciar,
      { jornadaId: JORNADA.id },
      { context: s2sContext(ana, orgA) },
    );
    await fingirQueComecouHa(orgA.id, ana.id, MINIMO + 1000);
    await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(ana, orgA) },
    );

    const daVizinha = await call(
      listar,
      {},
      { context: s2sContext(clara, orgB) },
    );
    const mesma = daVizinha.jornadas.find((j) => j.id === JORNADA.id);

    expect(mesma?.meuProgresso).toBeNull();
    expect(mesma?.recompensaDaOrg.creditada).toBe(false);
    expect(mesma?.recompensaDaOrg.porNome).toBeNull();

    const saldoB = await prisma.organization.findUniqueOrThrow({
      where: { id: orgB.id },
      select: { starsBalance: true },
    });
    expect(Number(saldoB.starsBalance)).toBe(0);
  });

  it("o colega vê que a recompensa da empresa já saiu, e por quem", async () => {
    await call(
      iniciar,
      { jornadaId: JORNADA.id },
      { context: s2sContext(ana, orgA) },
    );
    await fingirQueComecouHa(orgA.id, ana.id, MINIMO + 1000);
    await call(
      concluir,
      { jornadaId: JORNADA.id, apressos: 0, tempos: [] },
      { context: s2sContext(ana, orgA) },
    );

    const doBruno = await call(
      listar,
      {},
      { context: s2sContext(bruno, orgA) },
    );
    const mesma = doBruno.jornadas.find((j) => j.id === JORNADA.id);

    expect(mesma?.recompensaDaOrg).toEqual({
      creditada: true,
      porNome: ana.name,
    });
    // O progresso continua sendo de cada um: ele ainda não fez.
    expect(mesma?.meuProgresso).toBeNull();
  });
});
