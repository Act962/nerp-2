import prisma from "@/lib/db";

export type GuestIdentity = {
  name: string;
  phone?: string | null;
};

/**
 * Resolve o `Customer` de quem pediu sem se cadastrar.
 *
 * O telefone é a chave: cliente que já pediu antes é reaproveitado em vez de
 * virar uma linha nova a cada lanche, e assim o histórico (e, mais adiante, o
 * saldo de fidelidade) fica todo no mesmo cadastro. Sem telefone não há como
 * reconhecer ninguém, então cria-se um cadastro novo mesmo.
 */
export async function resolveGuestCustomer({
  organizationId,
  guest,
  origem,
}: {
  organizationId: string;
  guest: GuestIdentity;
  origem: string;
}): Promise<string> {
  const name = guest.name.trim();
  const phone = guest.phone?.trim() || null;

  if (phone) {
    const existing = await prisma.customer.findFirst({
      where: { organizationId, phone },
      select: { id: true },
    });

    if (existing) {
      // O nome pode ter vindo mais completo desta vez.
      await prisma.customer.update({
        where: { id: existing.id },
        data: { name },
      });
      return existing.id;
    }
  }

  const created = await prisma.customer.create({
    data: { organizationId, name, phone, notes: origem },
    select: { id: true },
  });

  return created.id;
}
