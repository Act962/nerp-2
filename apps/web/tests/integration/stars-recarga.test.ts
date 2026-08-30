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
    data: { starsBalance: 0, starsCycleStart: null },
  });
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
  it("não credita organização sem assinatura", async () => {
    const resultado = await garantirCreditoDoCiclo(org.id);
    expect(resultado.creditou).toBe(false);
  });

  it("credita uma vez por mês, conforme o plano", async () => {
    await prisma.tradeSubscription.create({
      data: { organizationId: org.id, plan: "PRATA", status: "ATIVA" },
    });

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
  });

  it("não credita duas vezes em chamadas simultâneas", async () => {
    await prisma.tradeSubscription.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, plan: "BRONZE", status: "ATIVA" },
      update: { plan: "BRONZE", status: "ATIVA" },
    });

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

  it("assinatura cancelada não credita", async () => {
    await prisma.tradeSubscription.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, plan: "OURO", status: "CANCELADA" },
      update: { plan: "OURO", status: "CANCELADA" },
    });

    const resultado = await garantirCreditoDoCiclo(org.id);
    expect(resultado.creditou).toBe(false);
  });

  it("inadimplente não credita, mesmo mantendo acesso aos módulos", async () => {
    await prisma.tradeSubscription.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, plan: "OURO", status: "INADIMPLENTE" },
      update: { plan: "OURO", status: "INADIMPLENTE" },
    });

    // Acesso é uma coisa; continuar dando ★ a quem não pagou é pagar a Meta
    // pela mensagem dele.
    const resultado = await garantirCreditoDoCiclo(org.id);
    expect(resultado.creditou).toBe(false);
  });

  it("o mês seguinte credita de novo", async () => {
    await prisma.tradeSubscription.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, plan: "BRONZE", status: "ATIVA" },
      update: { plan: "BRONZE", status: "ATIVA" },
    });

    const agosto = new Date(Date.UTC(2026, 7, 15));
    expect((await garantirCreditoDoCiclo(org.id, agosto)).creditou).toBe(true);
    expect((await garantirCreditoDoCiclo(org.id, agosto)).creditou).toBe(false);

    const setembro = new Date(Date.UTC(2026, 8, 2));
    expect((await garantirCreditoDoCiclo(org.id, setembro)).creditou).toBe(
      true,
    );

    const saldo = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: { starsBalance: true },
    });
    expect(saldo.starsBalance).toBe(1000);
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
