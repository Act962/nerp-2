import { call } from "@orpc/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * Recarga de ★ e crédito mensal do plano.
 *
 * O Stripe é dublado — o que interessa é o que o **nosso lado** garante: o
 * preço não vem do navegador, o webhook não credita duas vezes, e o crédito do
 * plano entra uma vez por mês mesmo com duas cobranças simultâneas na virada.
 */

type ArgumentosDaSessao = {
  line_items: { price_data: { unit_amount: number } }[];
  metadata: Record<string, string>;
};

const criarSessao = vi.fn(async (_argumentos: ArgumentosDaSessao) => ({
  id: "cs_teste_1",
  url: "https://checkout.stripe.com/c/pay/cs_teste_1",
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { create: criarSessao } } },
}));

/**
 * O plano vem do catálogo em código, não do banco. Aqui ele é dublado para
 * testar o crédito do ciclo com um plano que dá ★ — os slots pagos do
 * catálogo ainda não têm valor, e o Grátis dá zero por ciclo.
 */
const planoDublado: { starsPorCiclo: number; nome: string } = {
  starsPorCiclo: 0,
  nome: "Grátis",
};
vi.mock("@/features/billing/server/plano-da-organizacao", async () => {
  const { PLANO_GRATIS } = await import("@/features/billing/lib/planos");
  return {
    planoDaOrganizacao: vi.fn(async () => ({
      plano: {
        ...PLANO_GRATIS,
        nome: planoDublado.nome,
        limites: {
          ...PLANO_GRATIS.limites,
          starsPorCiclo: planoDublado.starsPorCiclo,
        },
      },
      origem: planoDublado.starsPorCiclo > 0 ? "assinatura" : "gratis",
    })),
  };
});

function usarPlanoComCiclo(starsPorCiclo: number, nome = "Plano de teste") {
  planoDublado.starsPorCiclo = starsPorCiclo;
  planoDublado.nome = nome;
}

function usarPlanoGratis() {
  planoDublado.starsPorCiclo = 0;
  planoDublado.nome = "Grátis";
}

const { createCheckout } = await import("@/app/router/stars/create-checkout");
const { listPackages } = await import("@/app/router/stars/list-packages");
const { garantirCreditoDoCiclo } = await import(
  "@/features/stars/server/credito-do-ciclo"
);
const { creditar } = await import("@/features/stars/server/debitar");
const prisma = (await import("@/lib/db")).default;
const { createMember, createOrg, createUser, resetDb, s2sContext } =
  await import("./helpers");

type Org = Awaited<ReturnType<typeof createOrg>>;
type Usuario = Awaited<ReturnType<typeof createUser>>;

let org: Org;
let dono: Usuario;

const ctx = () => ({ context: s2sContext(dono, org) });

beforeAll(async () => {
  await resetDb();
  org = await createOrg("Loja que recarrega");
  dono = await createUser();
  await createMember(dono, org);
});

beforeEach(async () => {
  vi.clearAllMocks();
  criarSessao.mockResolvedValue({
    id: "cs_teste_1",
    url: "https://checkout.stripe.com/c/pay/cs_teste_1",
  });
  await prisma.starsPayment.deleteMany({ where: { organizationId: org.id } });
  await prisma.starTransaction.deleteMany({
    where: { organizationId: org.id },
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { starsBalance: 0, starsCycleStart: null, starsUsedInCycle: 0 },
  });
  usarPlanoGratis();
});

afterAll(async () => {
  await prisma.starPackage.deleteMany({});
  await resetDb();
});

describe("pacotes", () => {
  it("semeia na primeira leitura e devolve preço em centavos", async () => {
    const { pacotes } = await call(listPackages, {}, ctx());

    expect(pacotes.length).toBeGreaterThan(0);
    // Centavos, e não `Decimal`: é o que o Stripe espera e o que atravessa a
    // fronteira do handler.
    expect(Number.isInteger(pacotes[0].precoCentavos)).toBe(true);
    expect(pacotes[0].precoCentavos).toBeGreaterThan(0);
  });
});

describe("abertura do pagamento", () => {
  it("o preço vem da tabela, não do cliente", async () => {
    const { pacotes } = await call(listPackages, {}, ctx());
    const pacote = pacotes[0];

    const resultado = await call(
      createCheckout,
      { packageId: pacote.id, voltarPara: "/whatsapp/creditos" },
      ctx(),
    );

    expect(resultado.url).toContain("checkout.stripe.com");

    // O valor mandado ao Stripe é o da tabela.
    const argumentos = criarSessao.mock.calls[0][0];
    expect(argumentos.line_items[0].price_data.unit_amount).toBe(
      pacote.precoCentavos,
    );
    // E o webhook vai achar a linha por este id, não pelo que o navegador
    // devolver na volta.
    expect(argumentos.metadata.starsPaymentId).toBe(resultado.paymentId);
  });

  it("grava a intenção como pendente antes de abrir a sessão", async () => {
    const { pacotes } = await call(listPackages, {}, ctx());
    const resultado = await call(
      createCheckout,
      { packageId: pacotes[0].id },
      ctx(),
    );

    const pagamento = await prisma.starsPayment.findUniqueOrThrow({
      where: { id: resultado.paymentId },
      select: { status: true, starsAmount: true, externalId: true },
    });
    expect(pagamento.status).toBe("pending");
    expect(pagamento.starsAmount).toBe(pacotes[0].stars);
    expect(pagamento.externalId).toBe("cs_teste_1");
  });

  it("nada é creditado só por abrir o pagamento", async () => {
    const { pacotes } = await call(listPackages, {}, ctx());
    await call(createCheckout, { packageId: pacotes[0].id }, ctx());

    const saldo = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { starsBalance: true },
    });
    expect(saldo.starsBalance).toBe(0);
  });

  it("marca como falha e avisa quando o Stripe recusa", async () => {
    criarSessao.mockRejectedValueOnce(new Error("cartão do país errado"));
    const { pacotes } = await call(listPackages, {}, ctx());

    await expect(
      call(createCheckout, { packageId: pacotes[0].id }, ctx()),
    ).rejects.toThrow(/não foi possível abrir o pagamento/i);

    // Sobra uma linha visível, em vez de um pagamento sem rastro.
    const falhou = await prisma.starsPayment.count({
      where: { organizationId: org.id, status: "failed" },
    });
    expect(falhou).toBe(1);
  });

  it("recusa pacote que não existe", async () => {
    await expect(
      call(createCheckout, { packageId: "inventado" }, ctx()),
    ).rejects.toThrow(/não encontrado/i);
  });
});

describe("crédito mensal do plano", () => {
  it("o Grátis não credita nada por mês: as 50 ★ são de boas-vindas", async () => {
    const resultado = await garantirCreditoDoCiclo(org.id);
    expect(resultado.creditou).toBe(false);
  });

  it("credita uma vez por mês, conforme o plano", async () => {
    usarPlanoComCiclo(1500, "Prata de teste");

    const primeira = await garantirCreditoDoCiclo(org.id);
    expect(primeira.creditou).toBe(true);
    expect(primeira.valor).toBe(1500);

    // Segunda chamada no mesmo mês não credita de novo.
    const segunda = await garantirCreditoDoCiclo(org.id);
    expect(segunda.creditou).toBe(false);

    const saldo = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { starsBalance: true },
    });
    expect(saldo.starsBalance).toBe(1500);

    const lancamento = await prisma.starTransaction.findFirstOrThrow({
      where: { organizationId: org.id, type: "PLAN_CREDIT" },
    });
    expect(lancamento.description).toContain("Prata de teste");
  });

  it("não credita duas vezes em chamadas simultâneas", async () => {
    usarPlanoComCiclo(500);

    // Duas mensagens chegando juntas na virada do mês.
    const resultados = await Promise.all([
      garantirCreditoDoCiclo(org.id),
      garantirCreditoDoCiclo(org.id),
    ]);

    expect(resultados.filter((r) => r.creditou)).toHaveLength(1);
    const saldo = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { starsBalance: true },
    });
    expect(saldo.starsBalance).toBe(500);
  });

  it("o mês seguinte credita de novo e zera o consumido do ciclo", async () => {
    usarPlanoComCiclo(500);

    const agosto = new Date(Date.UTC(2026, 7, 15));
    expect((await garantirCreditoDoCiclo(org.id, agosto)).creditou).toBe(true);
    expect((await garantirCreditoDoCiclo(org.id, agosto)).creditou).toBe(false);

    // O ciclo guarda o PRIMEIRO DIA DO MÊS de referência, não o instante do
    // crédito.
    const ciclo = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { starsCycleStart: true },
    });
    expect(ciclo.starsCycleStart).toEqual(new Date(Date.UTC(2026, 7, 1)));

    // Gasta um pouco em agosto: o consumido precisa sumir na virada.
    await prisma.organization.update({
      where: { id: org.id },
      data: { starsUsedInCycle: 120 },
    });

    const setembro = new Date(Date.UTC(2026, 8, 2));
    expect((await garantirCreditoDoCiclo(org.id, setembro)).creditou).toBe(
      true,
    );

    const depois = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { starsBalance: true, starsUsedInCycle: true },
    });
    expect(depois.starsBalance).toBe(1000);
    expect(depois.starsUsedInCycle).toBe(0);
  });
});

describe("extrato", () => {
  it("distingue recarga de crédito do plano", async () => {
    await creditar({
      organizationId: org.id,
      valor: 500,
      tipo: "TOPUP_PURCHASE",
      descricao: "Recarga de 500 ★",
    });

    const lancamento = await prisma.starTransaction.findFirstOrThrow({
      where: { organizationId: org.id },
      orderBy: { createdAt: "desc" },
      select: { type: true, amount: true, balanceAfter: true },
    });
    expect(lancamento.type).toBe("TOPUP_PURCHASE");
    expect(lancamento.amount).toBe(500);
    expect(lancamento.balanceAfter).toBe(500);
  });
});
