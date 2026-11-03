import "server-only";

import { ORPCError } from "@orpc/server";
import { Prisma } from "@/generated/prisma/client";
import type {
  MotivoAprovacaoPedido,
  PaymentMethod,
  SaleStatus,
} from "@/generated/prisma/enums";
import { createSaleFinanceEntries } from "@/features/financeiro/server/sale-entries";
import { resolveManyPrices } from "@/features/precos/server/resolve-price";
import { applySaleStockOut } from "@/features/sales/server/stock-out";
import prisma from "@/lib/db";
import {
  centavos,
  flexDoPedido,
  type ItemDaRegra,
  motivosDeAprovacao,
  statusInicial,
  type TipoPedido,
  totalDoPedido,
} from "../lib/regras-pedido";
import { dividirEmParcelas } from "../lib/parcelas";
import {
  type ConfiguracaoFv,
  garantirPerfil,
  obterConfiguracao,
  politicaDoVendedor,
} from "./configuracao";
import { destinoDoPedido } from "./destino";
import {
  type ContextoVendedor,
  clienteVisivel,
  filtroDeMembro,
  membroNoEscopo,
} from "./escopo-equipe";
import { fonteComercialDaOrg } from "./fontes";

export type ItemDeEntrada = {
  productId: string;
  quantidade: number;
  /** Preço negociado. Vazio = preço de tabela do cliente. */
  precoUnitario?: number | null;
};

export type EntradaDoPedido = {
  customerId: string;
  tipo: TipoPedido;
  condicaoPagamentoId?: string | null;
  visitaId?: string | null;
  observacao?: string | null;
  itens: ItemDeEntrada[];
};

const ABERTOS: SaleStatus[] = ["PENDING_APPROVAL", "CONFIRMED"];

function naoEncontrado(message: string): never {
  throw new ORPCError("NOT_FOUND", { message });
}

function invalido(message: string): never {
  throw new ORPCError("BAD_REQUEST", { message });
}

/** Total dos pedidos de campo do cliente aprovados ou em aprovação. */
async function pedidosNaoFaturados(
  organizationId: string,
  customerId: string,
  ignorarSaleId?: string,
): Promise<number> {
  const soma = await prisma.sale.aggregate({
    where: {
      organizationId,
      customerId,
      origin: "FORCA_VENDAS",
      status: { in: ABERTOS },
      ...(ignorarSaleId ? { id: { not: ignorarSaleId } } : {}),
    },
    _sum: { total: true },
  });
  return Number(soma._sum.total ?? 0);
}

/** Saldo flex + o que os pedidos ainda não faturados vão mexer nele. */
async function saldoFlexPrevisto(
  organizationId: string,
  memberId: string,
  saldoAtual: number,
  ignorarSaleId?: string,
): Promise<number> {
  const soma = await prisma.pedidoForcaVendas.aggregate({
    where: {
      organizationId,
      memberId,
      sale: { status: { in: ABERTOS } },
      ...(ignorarSaleId ? { saleId: { not: ignorarSaleId } } : {}),
    },
    _sum: { flexPrevisto: true },
  });
  return saldoAtual + Number(soma._sum.flexPrevisto ?? 0);
}

/**
 * Tudo que decide o pedido, sem gravar nada: preço de tabela do cliente,
 * flex, situação de crédito e motivos de aprovação. A simulação da tela e o
 * envio passam por aqui — o número que o vendedor vê é o que o servidor grava.
 */
async function prepararPedido(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  entrada: EntradaDoPedido;
  ignorarSaleId?: string;
}) {
  const { organizationId, vendedor, entrada } = args;
  if (entrada.itens.length === 0) invalido("Adicione ao menos um produto");
  if (entrada.itens.some((item) => item.quantidade <= 0)) {
    invalido("Quantidade precisa ser maior que zero");
  }

  if (
    !(await clienteVisivel(organizationId, vendedor.escopo, entrada.customerId))
  ) {
    naoEncontrado("Cliente não encontrado na sua carteira");
  }
  const cliente = await prisma.customer.findFirst({
    where: { id: entrada.customerId, organizationId },
    select: {
      id: true,
      name: true,
      document: true,
      erpCode: true,
      priceListId: true,
      creditLimit: true,
      isBlocked: true,
    },
  });
  if (!cliente) naoEncontrado("Cliente não encontrado");

  const productIds = Array.from(
    new Set(entrada.itens.map((item) => item.productId)),
  );
  const produtos = await prisma.product.findMany({
    where: { id: { in: productIds }, organizationId, isActive: true },
    select: { id: true, name: true, erpCode: true },
  });
  if (produtos.length !== productIds.length) {
    invalido("Algum produto do pedido não está mais ativo");
  }
  const produtoPorId = new Map(
    produtos.map((produto) => [produto.id, produto]),
  );

  let condicao: {
    id: string;
    nome: string;
    prazosDias: number[];
    formaPagamento: PaymentMethod;
  } | null = null;
  if (entrada.condicaoPagamentoId) {
    condicao = await prisma.condicaoPagamento.findFirst({
      where: { id: entrada.condicaoPagamentoId, organizationId, ativo: true },
      select: { id: true, nome: true, prazosDias: true, formaPagamento: true },
    });
    if (!condicao) naoEncontrado("Condição de pagamento não encontrada");
  }

  if (entrada.visitaId) {
    const visita = await prisma.visitaCliente.findFirst({
      where: {
        id: entrada.visitaId,
        organizationId,
        memberId: vendedor.memberId,
        customerId: entrada.customerId,
      },
      select: { id: true },
    });
    if (!visita) naoEncontrado("Visita não encontrada");
  }

  const [config, perfil, precos] = await Promise.all([
    obterConfiguracao(organizationId),
    garantirPerfil(organizationId, vendedor.memberId),
    resolveManyPrices({
      organizationId,
      priceListId: cliente.priceListId,
      items: entrada.itens.map((item) => ({
        productId: item.productId,
        quantity: item.quantidade,
      })),
    }),
  ]);
  const politica = politicaDoVendedor(config, perfil);
  const semValor = entrada.tipo === "BONIFICACAO" || entrada.tipo === "TROCA";

  const itens = entrada.itens.map((item, indice) => {
    const precoTabela = precos[indice]?.unitPrice ?? 0;
    const precoUnitario = semValor
      ? 0
      : centavos(item.precoUnitario ?? precoTabela);
    if (precoUnitario < 0) invalido("Preço não pode ser negativo");
    const produto = produtoPorId.get(item.productId);
    return {
      productId: item.productId,
      nome: produto?.name ?? "",
      codigoErp: produto?.erpCode ?? null,
      quantidade: item.quantidade,
      precoTabela,
      precoUnitario,
    };
  });
  const regra: ItemDaRegra[] = itens;

  const fonte = await fonteComercialDaOrg(organizationId);
  const [resumos, emPedidos, saldoPrevisto, estoque] = await Promise.all([
    fonte.resumoFinanceiro([cliente.id]),
    pedidosNaoFaturados(organizationId, cliente.id, args.ignorarSaleId),
    saldoFlexPrevisto(
      organizationId,
      vendedor.memberId,
      Number(perfil.saldoFlex),
      args.ignorarSaleId,
    ),
    fonte.estoque(productIds),
  ]);
  const resumo = resumos.get(cliente.id);
  const situacao = {
    bloqueado: cliente.isBlocked,
    vencido: resumo?.vencido ?? 0,
    limiteCredito:
      cliente.creditLimit === null ? null : Number(cliente.creditLimit),
    exposicao: (resumo?.emAberto ?? 0) + emPedidos,
  };

  const motivos = motivosDeAprovacao({
    tipo: entrada.tipo,
    itens: regra,
    politica,
    cliente: situacao,
    saldoFlexPrevisto: saldoPrevisto,
    bloquearInadimplente: config.bloquearInadimplente,
  });

  return {
    config,
    perfil,
    politica,
    cliente,
    condicao,
    itens,
    situacao,
    saldoFlexAtual: Number(perfil.saldoFlex),
    saldoFlexPrevisto: saldoPrevisto,
    flex: flexDoPedido(entrada.tipo, regra, politica),
    total: totalDoPedido(entrada.tipo, regra),
    motivos,
    status: statusInicial(entrada.tipo, motivos, config.autoAprovar),
    priceListId: precos[0]?.priceListId ?? null,
    estoque,
  };
}

export async function simularPedido(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  entrada: EntradaDoPedido;
}) {
  const prep = await prepararPedido(args);
  return {
    itens: prep.itens.map((item) => {
      const estoque = prep.estoque.get(item.productId);
      return {
        productId: item.productId,
        nome: item.nome,
        quantidade: item.quantidade,
        precoTabela: item.precoTabela,
        precoUnitario: item.precoUnitario,
        total: centavos(item.precoUnitario * item.quantidade),
        descontoPercent:
          item.precoTabela > 0
            ? centavos(
                ((item.precoTabela - item.precoUnitario) / item.precoTabela) *
                  100,
              )
            : 0,
        disponivel: estoque?.controlaEstoque ? estoque.disponivel : null,
      };
    }),
    total: prep.total,
    flex: prep.flex,
    saldoFlexAtual: prep.saldoFlexAtual,
    saldoFlexPrevisto: centavos(prep.saldoFlexPrevisto + prep.flex),
    motivos: prep.motivos,
    status: prep.status,
    politica: prep.politica,
    situacao: prep.situacao,
  };
}

/** Manda o pedido confirmado ao destino da org e guarda o resultado. */
export async function enviarAoDestino(saleId: string): Promise<void> {
  const pedido = await prisma.pedidoForcaVendas.findUnique({
    where: { saleId },
    include: {
      condicaoPagamento: { select: { nome: true, prazosDias: true } },
      member: { select: { vendedorPerfil: { select: { codigo: true } } } },
      sale: {
        include: {
          customer: {
            select: { id: true, name: true, document: true, erpCode: true },
          },
          items: {
            include: { product: { select: { erpCode: true } } },
          },
        },
      },
    },
  });
  if (!pedido?.sale.customer) return;

  const destino = destinoDoPedido(pedido.destino);
  let resultado: Awaited<ReturnType<typeof destino.enviar>>;
  try {
    resultado = await destino.enviar({
      organizationId: pedido.organizationId,
      saleId,
      numero: pedido.sale.saleNumber,
      tipo: pedido.tipo,
      cliente: {
        id: pedido.sale.customer.id,
        nome: pedido.sale.customer.name,
        documento: pedido.sale.customer.document,
        codigoErp: pedido.sale.customer.erpCode,
      },
      vendedor: {
        memberId: pedido.memberId,
        codigoErp: pedido.member?.vendedorPerfil?.codigo ?? null,
      },
      condicao: pedido.condicaoPagamento,
      itens: pedido.sale.items.map((item) => ({
        productId: item.productId,
        codigoErp: item.product.erpCode,
        nome: item.productName,
        quantidade: Number(item.quantity),
        precoUnitario: Number(item.unitPrice),
      })),
      total: Number(pedido.sale.total),
      observacao: pedido.sale.notes,
    });
  } catch (error) {
    resultado = {
      status: "ERRO",
      erro: error instanceof Error ? error.message : "Falha ao enviar o pedido",
    };
  }

  await prisma.pedidoForcaVendas.update({
    where: { saleId },
    data:
      resultado.status === "ACEITO"
        ? {
            statusDestino: "ACEITO",
            referenciaDestino: resultado.referencia,
            erroDestino: null,
          }
        : { statusDestino: resultado.status, erroDestino: resultado.erro },
  });
}

export async function enviarPedido(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  entrada: EntradaDoPedido & {
    clientOperationId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
}) {
  const { organizationId, vendedor, entrada } = args;

  if (entrada.clientOperationId) {
    const existente = await prisma.sale.findUnique({
      where: { clientOperationId: entrada.clientOperationId },
      select: {
        id: true,
        saleNumber: true,
        status: true,
        organizationId: true,
      },
    });
    if (existente && existente.organizationId === organizationId) {
      return {
        saleId: existente.id,
        numero: existente.saleNumber,
        status: existente.status,
        motivos: [],
      };
    }
  }

  const prep = await prepararPedido({ organizationId, vendedor, entrada });
  const agora = new Date();

  let criado: { id: string; saleNumber: number };
  try {
    criado = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: organizationId },
        data: { lastSaleNumber: { increment: 1 } },
        select: { lastSaleNumber: true },
      });
      return tx.sale.create({
        data: {
          organizationId,
          customerId: prep.cliente.id,
          saleNumber: org.lastSaleNumber,
          clientOperationId: entrada.clientOperationId ?? null,
          priceListId: prep.priceListId,
          status: prep.status,
          origin: "FORCA_VENDAS",
          subtotal: prep.total,
          total: prep.total,
          notes: entrada.observacao?.trim() || null,
          createdById: vendedor.userId,
          sellerMemberId: vendedor.memberId,
          items: {
            createMany: {
              data: prep.itens.map((item) => ({
                productId: item.productId,
                productName: item.nome,
                quantity: item.quantidade,
                requestedQuantity: item.quantidade,
                unitPrice: item.precoUnitario,
                tableUnitPrice: item.precoTabela,
                total: centavos(item.precoUnitario * item.quantidade),
              })),
            },
          },
          pedidoForcaVendas: {
            create: {
              organizationId,
              memberId: vendedor.memberId,
              tipo: entrada.tipo,
              condicaoPagamentoId: prep.condicao?.id ?? null,
              visitaId: entrada.visitaId ?? null,
              motivosAprovacao: prep.motivos as MotivoAprovacaoPedido[],
              flexPrevisto: prep.flex,
              capturadoEm: agora,
              latitude: entrada.latitude ?? null,
              longitude: entrada.longitude ?? null,
              destino: prep.config.destinoPedido,
              decididoEm: prep.status === "CONFIRMED" ? agora : null,
            },
          },
        },
        select: { id: true, saleNumber: true },
      });
    });
  } catch (error) {
    // Dois envios do mesmo pedido ao mesmo tempo (reenvio sem sinal): o
    // segundo bate no único de `clientOperationId` e devolve o primeiro.
    if (
      entrada.clientOperationId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existente = await prisma.sale.findUnique({
        where: { clientOperationId: entrada.clientOperationId },
        select: { id: true, saleNumber: true, status: true },
      });
      if (existente) {
        return {
          saleId: existente.id,
          numero: existente.saleNumber,
          status: existente.status,
          motivos: [],
        };
      }
    }
    throw error;
  }

  if (prep.status === "CONFIRMED") await enviarAoDestino(criado.id);

  return {
    saleId: criado.id,
    numero: criado.saleNumber,
    status: prep.status as SaleStatus,
    motivos: prep.motivos,
  };
}

async function carregarPedido(organizationId: string, saleId: string) {
  const pedido = await prisma.pedidoForcaVendas.findFirst({
    where: { saleId, organizationId },
    select: {
      memberId: true,
      tipo: true,
      sale: { select: { status: true, saleNumber: true } },
    },
  });
  if (!pedido) naoEncontrado("Pedido não encontrado");
  return pedido;
}

export async function decidirPedido(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  saleId: string;
  aprovar: boolean;
  motivoRecusa?: string | null;
}) {
  const { organizationId, vendedor, saleId } = args;
  if (!vendedor.podeAprovar) {
    throw new ORPCError("FORBIDDEN", {
      message: "Você não pode aprovar pedidos",
    });
  }
  const pedido = await carregarPedido(organizationId, saleId);
  if (!membroNoEscopo(vendedor.escopo, pedido.memberId)) {
    naoEncontrado("Pedido não encontrado");
  }
  if (!args.aprovar && !args.motivoRecusa?.trim()) {
    invalido("Diga ao vendedor por que o pedido foi recusado");
  }

  const agora = new Date();
  // `updateMany` com o status na condição: dois gestores decidindo ao mesmo
  // tempo não aprovam e recusam o mesmo pedido.
  const { count } = await prisma.sale.updateMany({
    where: { id: saleId, organizationId, status: "PENDING_APPROVAL" },
    data: args.aprovar
      ? { status: "CONFIRMED" }
      : { status: "CANCELLED", cancelledAt: agora },
  });
  if (count === 0) invalido("Este pedido já foi decidido");

  await prisma.pedidoForcaVendas.update({
    where: { saleId },
    data: {
      decididoPorId: vendedor.userId,
      decididoEm: agora,
      motivoRecusa: args.aprovar ? null : args.motivoRecusa?.trim(),
    },
  });

  if (args.aprovar) await enviarAoDestino(saleId);
}

export async function cancelarPedido(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  saleId: string;
  motivo?: string | null;
}) {
  const { organizationId, vendedor, saleId } = args;
  const pedido = await carregarPedido(organizationId, saleId);
  const proprio = pedido.memberId === vendedor.memberId;
  if (!proprio && !membroNoEscopo(vendedor.escopo, pedido.memberId)) {
    naoEncontrado("Pedido não encontrado");
  }
  const status = pedido.sale.status;
  if (status === "COMPLETED" || status === "CANCELLED") {
    invalido("Pedido faturado ou já cancelado não pode ser cancelado aqui");
  }
  // Depois de aprovado, só quem aprova desfaz — o vendedor sozinho só cancela
  // orçamento e pedido que ainda está em aprovação.
  if (status === "CONFIRMED" && !vendedor.podeAprovar) {
    throw new ORPCError("FORBIDDEN", {
      message: "Pedido aprovado só pode ser cancelado pelo supervisor",
    });
  }

  const { count } = await prisma.sale.updateMany({
    where: { id: saleId, organizationId, status },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  if (count === 0)
    invalido("O pedido mudou enquanto você cancelava. Abra de novo.");
  if (args.motivo?.trim()) {
    await prisma.pedidoForcaVendas.update({
      where: { saleId },
      data: { motivoRecusa: args.motivo.trim() },
    });
  }
}

/** Orçamento vira pedido: as regras rodam de novo com os dados de agora. */
export async function enviarOrcamento(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  saleId: string;
}) {
  const { organizationId, vendedor, saleId } = args;
  const venda = await prisma.sale.findFirst({
    where: { id: saleId, organizationId, origin: "FORCA_VENDAS" },
    select: {
      status: true,
      customerId: true,
      notes: true,
      items: {
        select: { id: true, productId: true, quantity: true, unitPrice: true },
      },
      pedidoForcaVendas: {
        select: {
          memberId: true,
          tipo: true,
          condicaoPagamentoId: true,
          visitaId: true,
        },
      },
    },
  });
  const pedido = venda?.pedidoForcaVendas;
  if (
    !venda ||
    !pedido ||
    !venda.customerId ||
    pedido.memberId !== vendedor.memberId
  ) {
    naoEncontrado("Orçamento não encontrado");
  }
  if (venda.status !== "DRAFT" || pedido.tipo !== "ORCAMENTO") {
    invalido("Só orçamento em aberto vira pedido");
  }

  const prep = await prepararPedido({
    organizationId,
    vendedor,
    ignorarSaleId: saleId,
    entrada: {
      customerId: venda.customerId,
      tipo: "VENDA",
      condicaoPagamentoId: pedido.condicaoPagamentoId,
      visitaId: pedido.visitaId,
      itens: venda.items.map((item) => ({
        productId: item.productId,
        quantidade: Number(item.quantity),
        precoUnitario: Number(item.unitPrice),
      })),
    },
  });

  const agora = new Date();
  await prisma.$transaction(async (tx) => {
    for (const [indice, item] of venda.items.entries()) {
      await tx.saleItem.update({
        where: { id: item.id },
        data: { tableUnitPrice: prep.itens[indice]?.precoTabela ?? null },
      });
    }
    await tx.sale.update({
      where: { id: saleId },
      data: { status: prep.status, subtotal: prep.total, total: prep.total },
    });
    await tx.pedidoForcaVendas.update({
      where: { saleId },
      data: {
        tipo: "VENDA",
        motivosAprovacao: prep.motivos as MotivoAprovacaoPedido[],
        flexPrevisto: prep.flex,
        decididoEm: prep.status === "CONFIRMED" ? agora : null,
      },
    });
  });

  if (prep.status === "CONFIRMED") await enviarAoDestino(saleId);
  return { status: prep.status, motivos: prep.motivos };
}

/**
 * Faturamento no receptor: é aqui que o estoque baixa, os títulos nascem (um
 * por parcela da condição) e o flex do vendedor é lançado. Corte de
 * quantidade entra antes de tudo isso — o vendedor é creditado pelo que saiu.
 */
export async function faturarPedido(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  saleId: string;
  cortes: Array<{ itemId: string; quantidade: number }>;
  config?: ConfiguracaoFv;
}) {
  const { organizationId, vendedor, saleId } = args;
  if (!vendedor.podeAprovar) {
    throw new ORPCError("FORBIDDEN", {
      message: "Você não pode faturar pedidos",
    });
  }
  const pedido = await carregarPedido(organizationId, saleId);
  if (!membroNoEscopo(vendedor.escopo, pedido.memberId)) {
    naoEncontrado("Pedido não encontrado");
  }
  if (pedido.sale.status !== "CONFIRMED") {
    invalido("Só pedido aprovado pode ser faturado");
  }

  const config = args.config ?? (await obterConfiguracao(organizationId));
  const perfil = pedido.memberId
    ? await garantirPerfil(organizationId, pedido.memberId)
    : null;
  const politica = politicaDoVendedor(config, perfil);
  const corteDe = new Map(
    args.cortes.map((corte) => [corte.itemId, corte.quantidade]),
  );
  const agora = new Date();

  await prisma.$transaction(async (tx) => {
    const venda = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      select: {
        saleNumber: true,
        createdAt: true,
        pedidoForcaVendas: {
          select: {
            tipo: true,
            condicaoPagamento: {
              select: { prazosDias: true, formaPagamento: true },
            },
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            tableUnitPrice: true,
            product: {
              select: { currentStock: true, trackStock: true, costPrice: true },
            },
          },
        },
      },
    });
    const tipo = venda.pedidoForcaVendas?.tipo ?? "VENDA";

    const itens = venda.items.map((item) => {
      const pedida = Number(item.quantity);
      const corte = corteDe.get(item.id);
      const quantidade = corte === undefined ? pedida : corte;
      if (quantidade < 0 || quantidade > pedida) {
        invalido("O corte não pode aumentar nem negativar a quantidade");
      }
      return { ...item, quantidade, preco: Number(item.unitPrice) };
    });

    for (const item of itens) {
      if (item.quantidade === Number(item.quantity)) continue;
      await tx.saleItem.update({
        where: { id: item.id },
        data: {
          quantity: item.quantidade,
          total: centavos(item.preco * item.quantidade),
        },
      });
    }

    const regra: ItemDaRegra[] = itens.map((item) => ({
      precoTabela: Number(item.tableUnitPrice ?? item.preco),
      precoUnitario: item.preco,
      quantidade: item.quantidade,
    }));
    const total = totalDoPedido(tipo, regra);

    const atualizado = await tx.sale.updateMany({
      where: { id: saleId, status: "CONFIRMED" },
      data: { status: "COMPLETED", completedAt: agora, subtotal: total, total },
    });
    if (atualizado.count === 0) invalido("Este pedido já foi faturado");

    const comSaida = itens.filter((item) => item.quantidade > 0);
    await applySaleStockOut(tx, {
      organizationId,
      saleId,
      createdById: vendedor.userId,
      items: comSaida.map((item) => ({
        productId: item.productId,
        quantity: item.quantidade,
      })),
      productById: new Map(
        comSaida.map((item) => [item.productId, item.product]),
      ),
    });

    const condicao = venda.pedidoForcaVendas?.condicaoPagamento;
    const parcelas =
      total > 0
        ? dividirEmParcelas(total, condicao?.prazosDias ?? [0], agora)
        : [];
    await createSaleFinanceEntries(tx, {
      organizationId,
      saleId,
      createdById: vendedor.userId,
      saleNumber: venda.saleNumber,
      saleDate: agora,
      total,
      cmv: comSaida.reduce(
        (soma, item) => soma + Number(item.product.costPrice) * item.quantidade,
        0,
      ),
      payments: parcelas.map((parcela, indice) => ({
        method: condicao?.formaPagamento ?? "BOLETO",
        amount: parcela.valor,
        dueDate: parcela.vencimento,
        parcela:
          parcelas.length > 1
            ? { atual: indice + 1, total: parcelas.length }
            : undefined,
      })),
    });

    const flex = flexDoPedido(tipo, regra, politica);
    if (perfil && flex !== 0) {
      const saldo = await tx.vendedorPerfil.update({
        where: { id: perfil.id },
        data: { saldoFlex: { increment: flex } },
        select: { saldoFlex: true },
      });
      await tx.lancamentoFlex.create({
        data: {
          organizationId,
          perfilId: perfil.id,
          tipo: "PEDIDO",
          valor: flex,
          saldoApos: saldo.saldoFlex,
          saleId,
          descricao: `Pedido #${venda.saleNumber}`,
          criadoPorId: vendedor.userId,
        },
      });
    }
  });
}

export async function listarPedidos(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  status?: SaleStatus | "ABERTOS";
  memberId?: string | null;
  customerId?: string | null;
  apenasMeus?: boolean;
  cursor?: string | null;
  limite: number;
}) {
  const filtroMembro = args.apenasMeus
    ? { in: [args.vendedor.memberId] }
    : args.memberId
      ? membroNoEscopo(args.vendedor.escopo, args.memberId)
        ? { in: [args.memberId] }
        : { in: [] }
      : filtroDeMembro(args.vendedor.escopo);

  const pedidos = await prisma.sale.findMany({
    where: {
      organizationId: args.organizationId,
      origin: "FORCA_VENDAS",
      ...(args.customerId ? { customerId: args.customerId } : {}),
      ...(args.status === "ABERTOS"
        ? { status: { in: ["DRAFT", ...ABERTOS] } }
        : args.status
          ? { status: args.status }
          : {}),
      pedidoForcaVendas: filtroMembro ? { memberId: filtroMembro } : {},
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.limite + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      saleNumber: true,
      status: true,
      total: true,
      createdAt: true,
      customer: { select: { id: true, name: true, tradeName: true } },
      _count: { select: { items: true } },
      pedidoForcaVendas: {
        select: {
          tipo: true,
          motivosAprovacao: true,
          flexPrevisto: true,
          statusDestino: true,
          member: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });

  const temMais = pedidos.length > args.limite;
  const pagina = temMais ? pedidos.slice(0, args.limite) : pedidos;
  return {
    pedidos: pagina.map((venda) => ({
      saleId: venda.id,
      numero: venda.saleNumber,
      status: venda.status,
      tipo: venda.pedidoForcaVendas?.tipo ?? "VENDA",
      total: Number(venda.total),
      itens: venda._count.items,
      criadoEm: venda.createdAt.toISOString(),
      cliente: venda.customer
        ? {
            id: venda.customer.id,
            nome: venda.customer.tradeName || venda.customer.name,
          }
        : null,
      vendedor: venda.pedidoForcaVendas?.member?.user.name ?? null,
      motivos: venda.pedidoForcaVendas?.motivosAprovacao ?? [],
      flexPrevisto: Number(venda.pedidoForcaVendas?.flexPrevisto ?? 0),
      statusDestino: venda.pedidoForcaVendas?.statusDestino ?? "PENDENTE",
    })),
    proximoCursor: temMais ? (pagina.at(-1)?.id ?? null) : null,
  };
}

export async function detalharPedido(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  saleId: string;
}) {
  const venda = await prisma.sale.findFirst({
    where: {
      id: args.saleId,
      organizationId: args.organizationId,
      origin: "FORCA_VENDAS",
    },
    select: {
      id: true,
      saleNumber: true,
      status: true,
      total: true,
      notes: true,
      createdAt: true,
      completedAt: true,
      cancelledAt: true,
      customer: {
        select: {
          id: true,
          name: true,
          tradeName: true,
          phone: true,
          document: true,
          city: true,
        },
      },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          requestedQuantity: true,
          unitPrice: true,
          tableUnitPrice: true,
          total: true,
        },
      },
      pedidoForcaVendas: {
        select: {
          memberId: true,
          tipo: true,
          motivosAprovacao: true,
          flexPrevisto: true,
          motivoRecusa: true,
          decididoEm: true,
          statusDestino: true,
          referenciaDestino: true,
          erroDestino: true,
          destino: true,
          condicaoPagamento: { select: { nome: true, prazosDias: true } },
          member: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });
  const pedido = venda?.pedidoForcaVendas;
  if (
    !venda ||
    !pedido ||
    !membroNoEscopo(args.vendedor.escopo, pedido.memberId)
  ) {
    naoEncontrado("Pedido não encontrado");
  }

  return {
    saleId: venda.id,
    numero: venda.saleNumber,
    status: venda.status,
    tipo: pedido.tipo,
    total: Number(venda.total),
    observacao: venda.notes,
    criadoEm: venda.createdAt.toISOString(),
    faturadoEm: venda.completedAt?.toISOString() ?? null,
    canceladoEm: venda.cancelledAt?.toISOString() ?? null,
    cliente: venda.customer
      ? {
          id: venda.customer.id,
          nome: venda.customer.tradeName || venda.customer.name,
          razaoSocial: venda.customer.name,
          telefone: venda.customer.phone,
          documento: venda.customer.document,
          cidade: venda.customer.city,
        }
      : null,
    vendedor: pedido.member?.user.name ?? null,
    ehMeu: pedido.memberId === args.vendedor.memberId,
    podeAprovar: args.vendedor.podeAprovar,
    itens: venda.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      nome: item.productName,
      quantidade: Number(item.quantity),
      quantidadePedida: Number(item.requestedQuantity ?? item.quantity),
      precoUnitario: Number(item.unitPrice),
      precoTabela:
        item.tableUnitPrice === null ? null : Number(item.tableUnitPrice),
      total: Number(item.total),
    })),
    motivos: pedido.motivosAprovacao,
    flexPrevisto: Number(pedido.flexPrevisto),
    motivoRecusa: pedido.motivoRecusa,
    decididoEm: pedido.decididoEm?.toISOString() ?? null,
    condicao: pedido.condicaoPagamento,
    destino: pedido.destino,
    statusDestino: pedido.statusDestino,
    referenciaDestino: pedido.referenciaDestino,
    erroDestino: pedido.erroDestino,
  };
}
