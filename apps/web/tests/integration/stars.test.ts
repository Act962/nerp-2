import { call } from "@orpc/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getBalance } from "@/app/router/stars/get-balance";
import { listTransactions } from "@/app/router/stars/list-transactions";
import {
  ACOES,
  cobrarAcao,
  cobrarAteOSaldo,
  cobrarValor,
  creditar,
  custoDaAcao,
  estornar,
  SaldoInsuficienteError,
} from "@/features/stars/server/debitar";
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
 * Stars — o crédito consumido por mensagem.
 *
 * Duas coisas definem o comportamento e são o que estes testes fixam: a
 * cobrança **começa desligada** (sem regra, nada é debitado nem bloqueado), e o
 * débito é **atômico** — duas mensagens simultâneas com saldo para uma só não
 * podem deixar a conta negativa.
 */

let org: Organization;
let admin: User;

async function saldo(): Promise<number> {
  const atual = await prisma.organization.findUniqueOrThrow({
    where: { id: org.id },
    select: { starsBalance: true },
  });
  return atual.starsBalance;
}

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Rede com crédito");
  admin = await createUser();
  await createMember(admin, org);
});

afterAll(resetDb);

describe("cobrança desligada por padrão", () => {
  it("não debita nem bloqueia quando não há regra cadastrada", async () => {
    const resultado = await cobrarAcao({
      organizationId: org.id,
      actionKey: ACOES.mensagemEnviada,
      descricao: "Mensagem",
    });

    // É o que permite ligar a cobrança por organização, quando o negócio
    // decidir, sem quebrar quem já usa.
    expect(resultado.cobrado).toBe(false);
    expect(await saldo()).toBe(0);
    expect(await prisma.starTransaction.count()).toBe(0);
  });

  it("nem quando a regra existe valendo zero", async () => {
    await prisma.starRule.create({
      data: {
        organizationId: org.id,
        actionKey: ACOES.mensagemEnviada,
        label: "Mensagem enviada",
        stars: 0,
      },
    });

    const resultado = await cobrarAcao({
      organizationId: org.id,
      actionKey: ACOES.mensagemEnviada,
      descricao: "Mensagem",
    });
    expect(resultado.cobrado).toBe(false);
  });
});

describe("cobrança ligada", () => {
  beforeAll(async () => {
    await prisma.starRule.update({
      where: {
        organizationId_actionKey: {
          organizationId: org.id,
          actionKey: ACOES.mensagemEnviada,
        },
      },
      data: { stars: 2 },
    });
    await creditar({
      organizationId: org.id,
      valor: 10,
      tipo: "TOPUP_PURCHASE",
      descricao: "Recarga de teste",
    });
  });

  it("debita e registra o saldo resultante no extrato", async () => {
    const resultado = await cobrarAcao({
      organizationId: org.id,
      actionKey: ACOES.mensagemEnviada,
      descricao: "Mensagem enviada no WhatsApp",
      userId: admin.id,
    });

    expect(resultado.cobrado).toBe(true);
    expect(resultado.valor).toBe(2);
    expect(await saldo()).toBe(8);

    const lancamento = await prisma.starTransaction.findFirstOrThrow({
      where: { organizationId: org.id, type: "APP_CHARGE" },
      orderBy: { createdAt: "desc" },
    });
    expect(lancamento.amount).toBe(-2);
    // O saldo resultante fica gravado: é o que permite auditar sem
    // reprocessar a soma inteira.
    expect(lancamento.balanceAfter).toBe(8);
  });

  it("recusa quando o saldo não cobre", async () => {
    await prisma.organization.update({
      where: { id: org.id },
      data: { starsBalance: 1 },
    });

    await expect(
      cobrarAcao({
        organizationId: org.id,
        actionKey: ACOES.mensagemEnviada,
        descricao: "Mensagem",
      }),
    ).rejects.toThrow(/insuficiente/i);

    // Recusou sem tirar nada.
    expect(await saldo()).toBe(1);
  });

  it("não deixa a conta negativa com cobranças simultâneas", async () => {
    // Saldo para uma cobrança de 2, duas cobranças ao mesmo tempo. Sem o
    // `updateMany` condicionado ao saldo, as duas leriam 2 e a conta ficaria
    // em -2.
    await prisma.organization.update({
      where: { id: org.id },
      data: { starsBalance: 2 },
    });

    const resultados = await Promise.allSettled([
      cobrarAcao({
        organizationId: org.id,
        actionKey: ACOES.mensagemEnviada,
        descricao: "Simultânea A",
      }),
      cobrarAcao({
        organizationId: org.id,
        actionKey: ACOES.mensagemEnviada,
        descricao: "Simultânea B",
      }),
    ]);

    const aceitas = resultados.filter((r) => r.status === "fulfilled").length;
    const recusadas = resultados.filter((r) => r.status === "rejected").length;

    expect(aceitas).toBe(1);
    expect(recusadas).toBe(1);
    expect(await saldo()).toBe(0);
  });

  it("o erro diz quanto falta", async () => {
    try {
      await cobrarAcao({
        organizationId: org.id,
        actionKey: ACOES.mensagemEnviada,
        descricao: "Sem saldo",
      });
      throw new Error("deveria ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(SaldoInsuficienteError);
      const tipado = erro as SaldoInsuficienteError;
      expect(tipado.data?.necessario).toBe(2);
      expect(tipado.data?.saldo).toBe(0);
    }
  });
});

describe("estorno", () => {
  it("devolve o valor como lançamento novo, sem apagar o débito", async () => {
    await creditar({
      organizationId: org.id,
      valor: 5,
      tipo: "MANUAL_ADJUST",
      descricao: "Ajuste",
    });
    const cobranca = await cobrarAcao({
      organizationId: org.id,
      actionKey: ACOES.mensagemEnviada,
      descricao: "Vai ser estornada",
    });
    const depoisDaCobranca = await saldo();

    await estornar({
      organizationId: org.id,
      valor: cobranca.valor,
      descricao: "Estorno: a mensagem não chegou a ser enviada",
      actionKey: ACOES.mensagemEnviada,
    });

    expect(await saldo()).toBe(depoisDaCobranca + cobranca.valor);

    // O débito continua no extrato — extrato que apaga história não serve
    // para auditoria.
    const debitos = await prisma.starTransaction.count({
      where: { organizationId: org.id, description: "Vai ser estornada" },
    });
    const estornos = await prisma.starTransaction.count({
      where: { organizationId: org.id, type: "REFUND" },
    });
    expect(debitos).toBe(1);
    expect(estornos).toBe(1);
  });
});

describe("stars.balance", () => {
  it("diz quantas mensagens ainda cabem", async () => {
    await prisma.organization.update({
      where: { id: org.id },
      data: { starsBalance: 9 },
    });

    const resultado = await call(
      getBalance,
      {},
      { context: s2sContext(admin, org) },
    );

    expect(resultado.saldo).toBe(9);
    expect(resultado.cobrancaAtiva).toBe(true);
    expect(resultado.precos.mensagem).toBe(2);
    // Saldo sozinho não diz nada para quem não sabe o preço.
    expect(resultado.mensagensRestantes).toBe(4);
  });

  it("avisa que a cobrança está desligada quando nenhuma ação tem preço", async () => {
    const outraOrg = await createOrg("Sem cobrança");
    const outroAdmin = await createUser();
    await createMember(outroAdmin, outraOrg);

    const resultado = await call(
      getBalance,
      {},
      { context: s2sContext(outroAdmin, outraOrg) },
    );

    expect(resultado.cobrancaAtiva).toBe(false);
    expect(resultado.mensagensRestantes).toBeNull();
  });
});

describe("stars.transactions", () => {
  it("lista do mais recente para o mais antigo, só da organização", async () => {
    const resultado = await call(
      listTransactions,
      { limite: 30 },
      { context: s2sContext(admin, org) },
    );

    expect(resultado.lancamentos.length).toBeGreaterThan(0);
    const datas = resultado.lancamentos.map((l) => l.quando);
    expect(datas).toEqual([...datas].sort().reverse());

    const daOrg = await prisma.starTransaction.count({
      where: { organizationId: org.id },
    });
    const total = await prisma.starTransaction.count();
    expect(resultado.lancamentos.length).toBeLessThanOrEqual(daOrg);
    expect(daOrg).toBeLessThanOrEqual(total);
  });
});

describe("débito por quantidade (o Astro)", () => {
  async function zerar(saldoInicial: number) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { starsBalance: saldoInicial, starsUsedInCycle: 0 },
    });
  }

  it("o Astro nasce com preço, sem regra cadastrada; a regra manda, inclusive zero", async () => {
    const limpa = await createOrg("Sem regra nenhuma");
    expect(await custoDaAcao(limpa.id, ACOES.astroTokens)).toBe(1);
    // O WhatsApp continua desligado por padrão.
    expect(await custoDaAcao(limpa.id, ACOES.mensagemEnviada)).toBe(0);

    await prisma.starRule.create({
      data: {
        organizationId: limpa.id,
        actionKey: ACOES.astroTokens,
        label: "Astro",
        stars: 0,
      },
    });
    expect(await custoDaAcao(limpa.id, ACOES.astroTokens)).toBe(0);
  });

  it("cobrarValor debita o valor pedido e soma no consumido do ciclo", async () => {
    await zerar(10);
    const resultado = await cobrarValor({
      organizationId: org.id,
      actionKey: ACOES.astroTokens,
      valor: 3,
      descricao: "Astro — 2.400 tokens",
    });
    expect(resultado.cobrado).toBe(true);
    expect(resultado.saldoDepois).toBe(7);

    const depois = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { starsUsedInCycle: true },
    });
    expect(depois.starsUsedInCycle).toBe(3);
  });

  it("cobrarValor recusa quando não há saldo", async () => {
    await zerar(2);
    await expect(
      cobrarValor({
        organizationId: org.id,
        actionKey: ACOES.astroTokens,
        valor: 3,
        descricao: "Astro",
      }),
    ).rejects.toBeInstanceOf(SaldoInsuficienteError);
    expect(await saldo()).toBe(2);
  });

  it("cobrarAteOSaldo cobra o que há, registra o parcial e nunca fica negativo", async () => {
    await zerar(2);
    const resultado = await cobrarAteOSaldo({
      organizationId: org.id,
      actionKey: ACOES.astroTokens,
      valor: 5,
      descricao: "Astro — 4.100 tokens",
    });
    expect(resultado.cobrado).toBe(true);
    expect(resultado.parcial).toBe(true);
    expect(resultado.valor).toBe(2);
    expect(resultado.valorPedido).toBe(5);
    expect(await saldo()).toBe(0);

    const lancamento = await prisma.starTransaction.findFirstOrThrow({
      where: { organizationId: org.id, actionKey: ACOES.astroTokens },
      orderBy: { createdAt: "desc" },
    });
    expect(lancamento.amount).toBe(-2);
    expect(lancamento.description).toContain("parcial");
  });

  it("cobrarAteOSaldo com saldo zero não lança nem grava", async () => {
    await zerar(0);
    const antes = await prisma.starTransaction.count({
      where: { organizationId: org.id },
    });
    const resultado = await cobrarAteOSaldo({
      organizationId: org.id,
      actionKey: ACOES.astroTokens,
      valor: 4,
      descricao: "Astro",
    });
    expect(resultado.cobrado).toBe(false);
    expect(resultado.parcial).toBe(true);
    const depois = await prisma.starTransaction.count({
      where: { organizationId: org.id },
    });
    expect(depois).toBe(antes);
  });

  it("duas cobranças parciais simultâneas não deixam a conta negativa", async () => {
    await zerar(3);
    await Promise.all([
      cobrarAteOSaldo({
        organizationId: org.id,
        actionKey: ACOES.astroTokens,
        valor: 2,
        descricao: "A",
      }),
      cobrarAteOSaldo({
        organizationId: org.id,
        actionKey: ACOES.astroTokens,
        valor: 2,
        descricao: "B",
      }),
    ]);
    expect(await saldo()).toBe(0);
  });
});

describe("stars.balance — uso do plano", () => {
  it("devolve limite, consumido, percentual e nível para a org Grátis", async () => {
    const nova = await createOrg("Nasceu no Grátis");
    const dono = await createUser();
    await createMember(dono, nova);
    await creditar({
      organizationId: nova.id,
      valor: 50,
      tipo: "WELCOME_BONUS",
      descricao: "Boas-vindas",
    });
    await cobrarValor({
      organizationId: nova.id,
      actionKey: ACOES.astroTokens,
      valor: 15,
      descricao: "Astro",
    });

    const resultado = await call(
      getBalance,
      {},
      { context: s2sContext(dono, nova) },
    );
    expect(resultado.plano.id).toBe("gratis");
    expect(resultado.limite).toBe(50);
    expect(resultado.consumido).toBe(15);
    expect(resultado.percentual).toBe(30);
    expect(resultado.saldo).toBe(35);
    expect(resultado.nivel).toBe("ok");
    expect(resultado.precos.astroPor1k).toBe(1);
  });
});
