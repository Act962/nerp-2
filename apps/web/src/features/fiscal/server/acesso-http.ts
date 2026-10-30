import "server-only";

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { hasFullAccess } from "@/lib/permissions";

/**
 * Sessão e organização para as rotas de download fiscal, que são HTTP puro
 * (arquivo binário não passa bem pelo oRPC). Devolve a resposta de erro
 * pronta quando não há acesso.
 */
export async function acessoFiscal(): Promise<
  | { ok: true; organizationId: string; acessoTotal: boolean }
  | { ok: false; resposta: NextResponse }
> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user?.id)
    return {
      ok: false,
      resposta: new NextResponse("Unauthorized", { status: 401 }),
    };
  const org = await auth.api.getFullOrganization({ headers: h });
  if (!org)
    return {
      ok: false,
      resposta: new NextResponse("Forbidden", { status: 403 }),
    };
  const membro = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: session.user.id },
    select: { role: true },
  });
  if (!membro)
    return {
      ok: false,
      resposta: new NextResponse("Forbidden", { status: 403 }),
    };
  return {
    ok: true,
    organizationId: org.id,
    acessoTotal: hasFullAccess(membro.role),
  };
}

export function respostaXml(bytes: Buffer | Uint8Array, nome: string) {
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}"`,
      "cache-control": "private, no-store",
    },
  });
}
