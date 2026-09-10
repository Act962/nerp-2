import "server-only";

import prisma from "@/lib/db";
import { enqueueSyncOutbox } from "@/lib/sync-outbox";

/**
 * O visitante virou gente: a conta provisória (anônima) entra com o Google.
 *
 * O plugin `anonymous` do Better Auth apagaria o usuário provisório depois de
 * chamar isto — mas ele é o `createdById` de tudo o que a pessoa fez na
 * sandbox (produto, venda, catálogo), colunas com FK restrita. Por isso o
 * plugin roda com `disableDeleteAnonymousUser` e a conta provisória fica:
 * sem sessão, sem `Account`, sem `Member`, marcada com `linkedToUserId`. O
 * histórico continua verdadeiro ("quem criou foi a conta provisória"), e a
 * organização passa a ser do usuário novo.
 */
export async function vincularContaAnonima(input: {
  anonimoId: string;
  novoId: string;
}): Promise<{ organizationIds: string[] }> {
  if (input.anonimoId === input.novoId) return { organizationIds: [] };

  const agora = new Date();

  const organizationIds = await prisma.$transaction(async (tx) => {
    const memberships = await tx.member.findMany({
      where: { userId: input.anonimoId },
      select: { id: true, organizationId: true, role: true },
    });

    for (const membro of memberships) {
      // `@@unique([organizationId, userId])`: se o e-mail do Google já era
      // membro desta org, o membro provisório sai e o existente fica.
      const jaMembro = await tx.member.findFirst({
        where: { organizationId: membro.organizationId, userId: input.novoId },
        select: { id: true },
      });
      if (jaMembro) {
        await tx.member.delete({ where: { id: membro.id } });
      } else {
        await tx.member.update({
          where: { id: membro.id },
          data: { userId: input.novoId },
        });
      }
    }

    const orgIds = memberships.map((m) => m.organizationId);

    // A organização vira verificada e ganha o endereço público que a sandbox
    // não tinha — se o slug ainda estiver livre como subdomínio.
    for (const organizationId of orgIds) {
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { slug: true, subdomain: true, verifiedAt: true },
      });
      const subdominioLivre =
        org.subdomain === null &&
        (await tx.organization.count({ where: { subdomain: org.slug } })) === 0;
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          verifiedAt: org.verifiedAt ?? agora,
          ...(subdominioLivre ? { subdomain: org.slug } : {}),
        },
      });
    }

    await tx.user.update({
      where: { id: input.anonimoId },
      data: {
        linkedToUserId: input.novoId,
        name: "Conta provisória (vinculada)",
      },
    });

    if (orgIds.length > 0) {
      await tx.session.updateMany({
        where: { userId: input.novoId },
        data: { activeOrganizationId: orgIds[0] },
      });
    }

    return orgIds;
  });

  // Replicação no NASA só agora: a sandbox não foi replicada de propósito.
  for (const organizationId of organizationIds) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        metadata: true,
        createdAt: true,
      },
    });
    if (!org) continue;
    await enqueueSyncOutbox("org", {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo ?? null,
      metadata: typeof org.metadata === "string" ? org.metadata : null,
      createdAt: org.createdAt.toISOString(),
    }).catch(() => {});
  }

  return { organizationIds };
}
