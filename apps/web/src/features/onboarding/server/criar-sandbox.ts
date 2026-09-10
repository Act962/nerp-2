import "server-only";

import { randomBytes } from "node:crypto";
import prisma from "@/lib/db";
import { RESPOSTAS_VAZIAS, type RespostasDoWizard } from "../lib/respostas";
import { inicializarOrganizacao } from "./inicializar-organizacao";

/**
 * A organização de teste de quem entrou pelo "Começar agora".
 *
 * Idempotente por usuário: quem já é dono de alguma organização recebe a
 * que tem (o `organizationLimit` do Better Auth também barra a segunda). É o
 * mesmo caminho do `after` do `POST /sign-in/anonymous` e da procedure de
 * recuperação `onboarding.criarSandbox` — se o hook falhar no meio, a tela
 * "sem empresa" oferece tentar de novo por aqui.
 */
export async function criarSandbox(input: {
  userId: string;
  respostas?: RespostasDoWizard;
}): Promise<{ organizationId: string; criou: boolean }> {
  const existente = await prisma.member.findFirst({
    where: { userId: input.userId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (existente)
    return { organizationId: existente.organizationId, criou: false };

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { id: true, isAnonymous: true },
  });

  const slug = `sandbox-${randomBytes(4).toString("hex")}`;
  const organization = await prisma.organization.create({
    data: {
      name: "Minha empresa",
      slug,
      status: "TRIAL",
      metadata: JSON.stringify({ name: "Minha empresa", sandbox: true }),
    },
  });
  const member = await prisma.member.create({
    data: { organizationId: organization.id, userId: user.id, role: "owner" },
  });

  await inicializarOrganizacao({
    organization,
    member,
    user,
    respostas: input.respostas ?? RESPOSTAS_VAZIAS,
  });

  return { organizationId: organization.id, criou: true };
}
