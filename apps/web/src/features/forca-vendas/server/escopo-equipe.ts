import "server-only";

import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";

/**
 * Quem vê o quê na Força de Vendas — a única fonte dessa resposta. Carteira,
 * pedidos, mapa, conversas e avisos filtram pelo `escopo` daqui.
 *
 * - owner/admin, coordenação e quem tem a gestão do módulo: todos;
 * - SUPERVISOR: ele e os subordinados (`Member.supervisorId`);
 * - vendedor: só ele.
 */
export type EscopoEquipe =
  | { tipo: "TODOS" }
  | { tipo: "MEMBROS"; memberIds: string[] };

export type ContextoVendedor = {
  memberId: string;
  userId: string;
  nome: string;
  imagem: string | null;
  /** Abre o módulo de campo. */
  acessaCampo: boolean;
  /** Abre o painel do gestor. */
  ehGestor: boolean;
  /** Aprova, recusa e fatura pedidos. */
  podeAprovar: boolean;
  escopo: EscopoEquipe;
};

export async function resolverVendedor(
  organizationId: string,
  userId: string,
): Promise<ContextoVendedor | null> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: {
      id: true,
      role: true,
      permissions: true,
      tradeRole: true,
      user: { select: { name: true, image: true } },
      supervisees: { select: { id: true } },
    },
  });
  if (!member) return null;

  const total = hasFullAccess(member.role);
  const permissoes = member.permissions ?? [];
  const ehGestor = total || permissoes.includes("forca-vendas-gestao");
  const acessaCampo = total || ehGestor || permissoes.includes("forca-vendas");

  let escopo: EscopoEquipe;
  if (total || member.tradeRole === "COORDENADOR_TRADE") {
    escopo = { tipo: "TODOS" };
  } else if (member.tradeRole === "SUPERVISOR") {
    escopo = {
      tipo: "MEMBROS",
      memberIds: [member.id, ...member.supervisees.map((sub) => sub.id)],
    };
  } else if (ehGestor) {
    escopo = { tipo: "TODOS" };
  } else {
    escopo = { tipo: "MEMBROS", memberIds: [member.id] };
  }

  return {
    memberId: member.id,
    userId,
    nome: member.user.name,
    imagem: member.user.image,
    acessaCampo,
    ehGestor,
    podeAprovar: total || permissoes.includes("forca-vendas-aprovar"),
    escopo,
  };
}

/** Filtro Prisma para um campo `memberId` dentro do escopo. */
export function filtroDeMembro(
  escopo: EscopoEquipe,
): { in: string[] } | undefined {
  return escopo.tipo === "TODOS" ? undefined : { in: escopo.memberIds };
}

export function membroNoEscopo(
  escopo: EscopoEquipe,
  memberId: string | null,
): boolean {
  if (escopo.tipo === "TODOS") return true;
  return memberId !== null && escopo.memberIds.includes(memberId);
}

/**
 * Clientes que o escopo enxerga. Quem vê todos enxerga a base inteira da
 * organização, com ou sem carteira; os demais, só a carteira do escopo.
 */
export function filtroDeClientes(escopo: EscopoEquipe) {
  if (escopo.tipo === "TODOS") return {};
  return { carteiras: { some: { memberId: { in: escopo.memberIds } } } };
}

export async function clienteVisivel(
  organizationId: string,
  escopo: EscopoEquipe,
  customerId: string,
): Promise<boolean> {
  const cliente = await prisma.customer.findFirst({
    where: { id: customerId, organizationId, ...filtroDeClientes(escopo) },
    select: { id: true },
  });
  return Boolean(cliente);
}
