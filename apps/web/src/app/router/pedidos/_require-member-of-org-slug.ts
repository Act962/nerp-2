import prisma from "@/lib/db";

type OrgFromSlug = { id: string; name: string; slug: string | null };

/**
 * Resolve a organização pelo slug da URL e exige que quem chamou seja membro.
 *
 * O app do garçom sempre soube em qual organização está pelo `orgSlug` da rota,
 * e não pela organização ativa da sessão: `acceptWaiterJoin` só define a org
 * ativa para quem entra pelo `joinToken`, então quem já era membro — ou é
 * membro de duas — teria a org ativa apontando para outro lugar. Por isso a
 * checagem é feita aqui, com o slug, em vez de `requireOrgMiddleware`.
 *
 * O `attendantId` que essas procedures recebem NÃO é credencial: é a escolha de
 * quem está atendendo (o `Collaborator` não é o `User` logado). Quem autoriza é
 * a sessão; o colaborador só assina o pedido.
 */
export async function requireMemberOfOrgSlug({
  orgSlug,
  userId,
  errors,
}: {
  orgSlug: string;
  userId: string;
  errors: {
    NOT_FOUND: (opts: { message: string }) => Error;
    FORBIDDEN: (opts: { message: string }) => Error;
  };
}): Promise<OrgFromSlug> {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true, slug: true },
  });

  if (!org) {
    throw errors.NOT_FOUND({ message: "Organização não encontrada!" });
  }

  const member = await prisma.member.findFirst({
    where: { organizationId: org.id, userId },
    select: { id: true },
  });

  if (!member) {
    throw errors.FORBIDDEN({
      message: "Você não faz parte desta equipe.",
    });
  }

  return org;
}
