import "server-only";

import prisma from "@/lib/db";

/**
 * O pacote de exemplo por SOLUÇÃO — o que faz cada tela abrir com algo
 * dentro, seja qual for o nicho: funil de CRM com etapas, etiquetas e leads
 * ligados aos clientes de exemplo; ações no calendário; um modelo de cupom;
 * um período de metas no ranking; e duas vendas concluídas, para o Astro e
 * os widgets terem número.
 *
 * Tudo `isDemo`, tudo apagável por `removerDadosDeExemplo`. Idempotente pelo
 * funil de exemplo: se ele existe, o pacote já entrou.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

function daquiADias(dias: number, hora: number): Date {
  const data = new Date(Date.now() + dias * DIA_MS);
  data.setUTCHours(hora + 3, 0, 0, 0); // hora local de Fortaleza (UTC-3)
  return data;
}

export async function seedSolucoesDemo(input: {
  organizationId: string;
  userId: string;
  memberId: string;
}): Promise<{ criou: boolean }> {
  const { organizationId, userId, memberId } = input;

  const jaTem = await prisma.crmFunnel.count({
    where: { organizationId, isDemo: true },
  });
  if (jaTem > 0) return { criou: false };

  const clientes = await prisma.customer.findMany({
    where: { organizationId, isDemo: true },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true, name: true, phone: true, email: true },
  });
  const produtos = await prisma.product.findMany({
    where: { organizationId, isDemo: true },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { id: true, name: true, salePrice: true },
  });

  // ── CRM: funil, etapas, etiquetas, leads ────────────────────────────
  const funil = await prisma.crmFunnel.create({
    data: {
      organizationId,
      name: "Vendas (exemplo)",
      description: "Do primeiro contato ao pedido fechado.",
      isDemo: true,
    },
    select: { id: true },
  });
  const nomesDeEtapa = [
    "Novo contato",
    "Em conversa",
    "Proposta enviada",
    "Fechado",
  ];
  const etapas = await Promise.all(
    nomesDeEtapa.map((name, ordem) =>
      prisma.crmStage.create({
        data: { organizationId, funnelId: funil.id, name, order: ordem },
        select: { id: true },
      }),
    ),
  );
  const etiquetas = [
    { name: "Cliente VIP", slug: "cliente-vip", color: "#f59e0b" },
    {
      name: "Precisa de retorno",
      slug: "precisa-de-retorno",
      color: "#ef4444",
    },
    {
      name: "Promoção da semana",
      slug: "promocao-da-semana",
      color: "#10b981",
    },
  ];
  for (const etiqueta of etiquetas) {
    await prisma.crmTag.create({
      data: { organizationId, funnelId: funil.id, ...etiqueta, isDemo: true },
    });
  }
  for (const [indice, cliente] of clientes.entries()) {
    const etapa = etapas[Math.min(indice, etapas.length - 1)];
    if (!etapa) continue;
    await prisma.crmLead.create({
      data: {
        organizationId,
        funnelId: funil.id,
        stageId: etapa.id,
        customerId: cliente.id,
        name: cliente.name,
        phone: cliente.phone ?? `5585990000${indice}0`,
        email: cliente.email,
        temperature: indice < 2 ? "HOT" : "WARM",
        amount: 250 + indice * 120,
        order: indice,
        isDemo: true,
      },
    });
  }

  // ── Calendário: três ações da semana ─────────────────────────────────
  const eventos = [
    {
      title: "Ação de PDV: degustação de café",
      type: "ACAO_PDV" as const,
      dias: 1,
    },
    {
      title: "Campanha: Ofertas da semana no WhatsApp",
      type: "CAMPANHA" as const,
      dias: 3,
    },
    {
      title: "Reunião com fornecedor Santa Clara",
      type: "REUNIAO" as const,
      dias: 5,
    },
  ];
  for (const evento of eventos) {
    const criado = await prisma.calendarEvent.create({
      data: {
        organizationId,
        title: evento.title,
        type: evento.type,
        startsAt: daquiADias(evento.dias, 9),
        endsAt: daquiADias(evento.dias, 11),
        isAllDay: false,
        createdById: memberId,
        isDemo: true,
      },
      select: { id: true },
    });
    await prisma.calendarChecklistItem.createMany({
      data: [
        {
          organizationId,
          eventId: criado.id,
          title: "Separar material",
          position: 0,
        },
        {
          organizationId,
          eventId: criado.id,
          title: "Confirmar equipe",
          position: 1,
        },
      ],
    });
  }

  // ── Cupom: um modelo padrão para o PDV imprimir ───────────────────────
  await prisma.receiptTemplate.create({
    data: {
      organizationId,
      name: "Cupom padrão (exemplo)",
      // O editor de cupom preenche os blocos ao abrir um modelo vazio.
      blocks: [],
      isDefault: true,
      isDemo: true,
    },
  });

  // ── Ranking: um período de metas com dois vendedores ─────────────────
  const inicio = new Date();
  inicio.setUTCDate(1);
  inicio.setUTCHours(3, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setUTCMonth(fim.getUTCMonth() + 1);
  const periodo = await prisma.salesGoalPeriod.create({
    data: {
      organizationId,
      periodType: "MONTHLY",
      periodStart: inicio,
      periodEnd: fim,
      label: "Metas do mês (exemplo)",
      importedByUserId: userId,
      isDemo: true,
    },
    select: { id: true },
  });
  const filial = await prisma.salesGoalBranch.create({
    data: { periodId: periodo.id, name: "Loja Centro" },
    select: { id: true },
  });
  await prisma.salesGoalEntry.createMany({
    data: [
      {
        branchId: filial.id,
        externalCode: "V01",
        goalName: "Meta mensal",
        sellerName: "Ana Ribeiro",
        goalAmount: 15000,
        achievedAmount: 9800,
        achievedIsManual: true,
      },
      {
        branchId: filial.id,
        externalCode: "V02",
        goalName: "Meta mensal",
        sellerName: "Carlos Melo",
        goalAmount: 15000,
        achievedAmount: 12400,
        achievedIsManual: true,
      },
    ],
  });

  // ── Vendas: duas concluídas, ontem e hoje ─────────────────────────────
  if (produtos.length >= 2 && clientes.length >= 1) {
    const [p1, p2] = produtos;
    const ontem = new Date(Date.now() - DIA_MS);
    const vendas = [
      {
        saleNumber: 1,
        customerId: clientes[0]?.id,
        quando: ontem,
        itens: [
          { produto: p1, qtd: 2 },
          { produto: p2, qtd: 1 },
        ],
      },
      {
        saleNumber: 2,
        customerId: clientes[1]?.id ?? clientes[0]?.id,
        quando: new Date(),
        itens: [{ produto: p2, qtd: 3 }],
      },
    ];
    for (const venda of vendas) {
      const total = venda.itens.reduce(
        (soma, i) => soma + Number(i.produto.salePrice) * i.qtd,
        0,
      );
      await prisma.sale.create({
        data: {
          organizationId,
          customerId: venda.customerId,
          saleNumber: venda.saleNumber,
          status: "COMPLETED",
          subtotal: total,
          total,
          paymentMethod: "PIX",
          paidAt: venda.quando,
          completedAt: venda.quando,
          createdAt: venda.quando,
          isDemo: true,
          items: {
            create: venda.itens.map((i) => ({
              productId: i.produto.id,
              productName: i.produto.name,
              quantity: i.qtd,
              unitPrice: i.produto.salePrice,
              total: Number(i.produto.salePrice) * i.qtd,
            })),
          },
        },
      });
    }
  }

  return { criou: true };
}
