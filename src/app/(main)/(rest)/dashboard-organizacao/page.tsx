import { OrgDashboardEditor } from "@/features/org-dashboard/components/org-dashboard-editor";
import { requirePermission } from "@/lib/auth-utils";

export default async function OrgDashboardPage() {
  // "dashboard-org" está no PAGE_PERMISSIONS — o painel de permissões da org
  // controla quem enxerga esta página. Owner/admin ignora o gate.
  await requirePermission("dashboard-org");

  // O cabeçalho (título + botão de tela cheia) mora dentro do editor: a tela
  // cheia é client-side (Fullscreen API) e precisa envolver o cabeçalho
  // também, senão ele fica preso fora da área expandida.
  return <OrgDashboardEditor />;
}
