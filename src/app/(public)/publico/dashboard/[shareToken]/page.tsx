import { PublicOrgDashboard } from "@/features/org-dashboard/components/public-org-dashboard";

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
