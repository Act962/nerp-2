import "server-only";

import prisma from "@/lib/db";

/**
 * Liga o lead a um cliente do ERP quando o telefone casa — e só quando casa
 * com **um** cliente.
 *
 * `Customer.phone` é texto livre no cadastro atual (máscara, sem DDI, com
 * espaços), então comparamos contra algumas formas equivalentes. Ambiguidade
 * não vira palpite: dois clientes com o mesmo número deixam o lead solto, e o
 * atendente decide.
 *
 * Mora aqui, e não no pipeline de inbound, porque o agendamento pela página
 * pública precisa exatamente da mesma decisão — e duas heurísticas de telefone
 * divergindo é como o mesmo cliente vira duas fichas.
 */
export async function acharClientePeloTelefone(
  telefone: string,
  organizationId: string,
): Promise<string | null> {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;

  const semPais = digitos.startsWith("55") ? digitos.slice(2) : digitos;
  const ddd = semPais.slice(0, 2);
  const numero = semPais.slice(2);

  const candidatos = Array.from(
    new Set([
      `+${digitos}`,
      digitos,
      semPais,
      `(${ddd}) ${numero.slice(0, numero.length - 4)}-${numero.slice(-4)}`,
    ]),
  );

  const clientes = await prisma.customer.findMany({
    where: { organizationId, phone: { in: candidatos } },
    select: { id: true },
    take: 2,
  });

  return clientes.length === 1 ? (clientes[0]?.id ?? null) : null;
}
