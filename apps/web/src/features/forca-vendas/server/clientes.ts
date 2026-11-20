import "server-only";

import { ORPCError } from "@orpc/server";
import prisma from "@/lib/db";
import { type ContextoVendedor, filtroDeClientes } from "./escopo-equipe";
import { fonteComercialDaOrg } from "./fontes";

const DIA_MS = 24 * 60 * 60 * 1000;

function diasDesde(iso: string | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DIA_MS);
}

export async function listarCarteira(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  busca?: string | null;
  cursor?: string | null;
  limite: number;
}) {
  const busca = args.busca?.trim();
  const clientes = await prisma.customer.findMany({
    where: {
      organizationId: args.organizationId,
      isActive: true,
      ...filtroDeClientes(args.vendedor.escopo),
      ...(busca
        ? {
            OR: [
              { name: { contains: busca, mode: "insensitive" } },
              { tradeName: { contains: busca, mode: "insensitive" } },
              { document: { contains: busca.replace(/\D/g, "") || busca } },
              { city: { contains: busca, mode: "insensitive" } },
              { erpCode: busca },
            ],
          }
        : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: args.limite + 1,
    ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      tradeName: true,
      city: true,
      neighborhood: true,
      phone: true,
      isBlocked: true,
      latitude: true,
      creditLimit: true,
    },
  });
  const temMais = clientes.length > args.limite;
  const pagina = temMais ? clientes.slice(0, args.limite) : clientes;
  const ids = pagina.map((cliente) => cliente.id);

  const fonte = await fonteComercialDaOrg(args.organizationId);
  const [resumos, ultimas] = await Promise.all([
    fonte.resumoFinanceiro(ids),
    fonte.ultimaCompraPorCliente(ids),
  ]);

  return {
    clientes: pagina.map((cliente) => ({
      id: cliente.id,
      nome: cliente.tradeName || cliente.name,
      razaoSocial: cliente.name,
      cidade:
        [cliente.neighborhood, cliente.city].filter(Boolean).join(" · ") ||
        null,
      telefone: cliente.phone,
      bloqueado: cliente.isBlocked,
      vencido: resumos.get(cliente.id)?.vencido ?? 0,
      diasSemComprar: diasDesde(ultimas.get(cliente.id)),
      temLocalizacao: cliente.latitude !== null,
    })),
    proximoCursor: temMais ? (pagina.at(-1)?.id ?? null) : null,
  };
}

export async function detalharCliente(args: {
  organizationId: string;
  vendedor: ContextoVendedor;
  customerId: string;
}) {
  const cliente = await prisma.customer.findFirst({
    where: {
      id: args.customerId,
      organizationId: args.organizationId,
      ...filtroDeClientes(args.vendedor.escopo),
    },
    select: {
      id: true,
      name: true,
      tradeName: true,
      document: true,
      email: true,
      phone: true,
      address: true,
      addressNumber: true,
      neighborhood: true,
      city: true,
      state: true,
      zipCode: true,
      notes: true,
      birthDate: true,
      creditLimit: true,
      latitude: true,
      longitude: true,
      segment: true,
      isBlocked: true,
      blockedReason: true,
      priceList: { select: { name: true } },
      carteiras: {
        select: {
          principal: true,
          member: { select: { id: true, user: { select: { name: true } } } },
        },
      },
    },
  });
  if (!cliente) {
    throw new ORPCError("NOT_FOUND", {
      message: "Cliente não encontrado na sua carteira",
    });
  }

  const fonte = await fonteComercialDaOrg(args.organizationId);
  const [resumos, compras, titulos, ultimas, emPedidos] = await Promise.all([
    fonte.resumoFinanceiro([cliente.id]),
    fonte.ultimasCompras(cliente.id, 10),
    fonte.titulosEmAberto([cliente.id]),
    fonte.ultimaCompraPorCliente([cliente.id]),
    prisma.sale.aggregate({
      where: {
        organizationId: args.organizationId,
        customerId: cliente.id,
        origin: "FORCA_VENDAS",
        status: { in: ["PENDING_APPROVAL", "CONFIRMED"] },
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);
  const resumo = resumos.get(cliente.id);
  const limite =
    cliente.creditLimit === null ? null : Number(cliente.creditLimit);
  const exposicao = (resumo?.emAberto ?? 0) + Number(emPedidos._sum.total ?? 0);
  const ticketMedio =
    compras.length > 0
      ? compras.reduce((soma, compra) => soma + compra.total, 0) /
        compras.length
      : null;

  const endereco = [
    [cliente.address, cliente.addressNumber].filter(Boolean).join(", "),
    cliente.neighborhood,
    [cliente.city, cliente.state].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: cliente.id,
    nome: cliente.tradeName || cliente.name,
    razaoSocial: cliente.name,
    documento: cliente.document,
    email: cliente.email,
    telefone: cliente.phone,
    endereco: endereco || null,
    observacoes: cliente.notes,
    aniversario: cliente.birthDate?.toISOString() ?? null,
    segmento: cliente.segment,
    tabelaDePreco: cliente.priceList?.name ?? null,
    bloqueado: cliente.isBlocked,
    motivoBloqueio: cliente.blockedReason,
    localizacao:
      cliente.latitude !== null && cliente.longitude !== null
        ? { latitude: cliente.latitude, longitude: cliente.longitude }
        : null,
    financeiro: {
      vencido: resumo?.vencido ?? 0,
      emAberto: resumo?.emAberto ?? 0,
      titulosVencidos: resumo?.titulosVencidos ?? 0,
      vencimentoMaisAntigo: resumo?.vencimentoMaisAntigo ?? null,
      limiteCredito: limite,
      limiteDisponivel: limite === null ? null : limite - exposicao,
      pedidosEmAberto: emPedidos._count,
    },
    diasSemComprar: diasDesde(ultimas.get(cliente.id)),
    ticketMedio,
    ultimasCompras: compras.slice(0, 5),
    titulos: titulos.slice(0, 20),
    vendedores: cliente.carteiras.map((carteira) => ({
      memberId: carteira.member.id,
      nome: carteira.member.user.name,
      principal: carteira.principal,
    })),
    origemDosDados: fonte.origem,
  };
}
