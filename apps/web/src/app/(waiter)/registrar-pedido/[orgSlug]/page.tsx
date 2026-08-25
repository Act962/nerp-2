import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { acceptWaiterJoin } from "@/lib/waiter-join";
import { WaiterApp } from "@/features/pedidos/waiter/components/waiter-app";
import { NoAccessNotice } from "@/features/pedidos/waiter/components/no-access-notice";

interface Props {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ joinToken?: string }>;
}

export const metadata: Metadata = {
  title: "Registrar pedido",
};

// Acesso requer login + membership na org do QR. Quem escaneia e não tem
// sessão é mandado para /cadastro (com joinToken) ou /login (sem token), com
// redirectTo de volta. Com um joinToken válido para esta org, um usuário logado
// sem membership entra automaticamente como garçom (auto-onboarding via QR).
export default async function RegistrarPedidoPage({
  params,
  searchParams,
}: Props) {
  const { orgSlug } = await params;
  const { joinToken } = await searchParams;
  const headersList = await headers();

  const session = await auth.api.getSession({ headers: headersList });
  if (!session) {
    const target = joinToken
      ? `/registrar-pedido/${orgSlug}?joinToken=${joinToken}`
      : `/registrar-pedido/${orgSlug}`;
    const redirectTo = encodeURIComponent(target);
    // Com token de convite mandamos para o cadastro (onboarding do garçom);
    // sem token, mantém o login tradicional.
    const dest = joinToken ? "cadastro" : "login";
    redirect(`/${dest}?redirectTo=${redirectTo}`);
  }

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, name: true },
  });
  if (!org) {
    return <NoAccessNotice orgName={orgSlug} reason="not-found" />;
  }

  let member = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: session.user.id },
    select: { id: true },
  });

  // Sem membership, mas com joinToken válido para esta org: auto-join (garçom).
  if (!member && joinToken) {
    const joined = await acceptWaiterJoin(
      session.user.id,
      org.id,
      joinToken,
      session.session.id,
    );
    if (joined) {
      member = await prisma.member.findFirst({
        where: { organizationId: org.id, userId: session.user.id },
        select: { id: true },
      });
    }
  }

  if (!member) {
    return <NoAccessNotice orgName={org.name} reason="no-membership" />;
  }

  // Usuário já logado e membro (não precisou criar conta): limpa o joinToken da
  // URL para não deixar o token exposto na barra de endereço.
  if (joinToken) {
    redirect(`/registrar-pedido/${orgSlug}`);
  }

  return <WaiterApp orgSlug={orgSlug} />;
}
