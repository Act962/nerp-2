import type { Metadata } from "next";
import { PublicOrgDashboard } from "@/features/org-dashboard/components/public-org-dashboard";

/*
  `noindex`: o endereço É a credencial.

  Esta página abre com um token na URL e sem login. Um link que vaze — colado
  num grupo, num e-mail que virou página web, numa barra de endereço com
  sincronização ligada — pode ser rastreado, e aí o "link secreto" passa a
  estar no índice do Google, achável por qualquer um.

  A raiz do app já é `noindex` por padrão (ver `src/app/layout.tsx`), mas aqui
  o valor é declarado de novo, de propósito: quem um dia mudar o padrão da raiz
  não pode levar estas páginas junto sem perceber.

  `follow: false` acompanha: os links de dentro apontam para dados da mesma
  organização.
*/
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

// Rota pública — leitura de um dashboard da organização via `shareToken`.
// Sem login: o roteador de oRPC dessa procedure não injeta auth/org, o
// filtro por `publicVisibleWidgetIds` acontece dentro da procedure.
//
// A carga inicial é feita no cliente (via `useQuery`) para não precisar de
// helper server-side de oRPC. O primeiro pintar é um skeleton curto —
// aceitável para uma tela de link público que já passa por CDN.
export default async function PublicDashboardPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  return <PublicOrgDashboard shareToken={shareToken} />;
}
