import { redirect } from "next/navigation";
import { requireSiteAdmin } from "@/lib/site-admin";
import { SiteAccess } from "@/features/site/components/site-access";

export default async function SiteAccessPage() {
  const access = await requireSiteAdmin();
  // A tela inteira é do super admin; quem não é nem chega a ver a lista.
  if (!access.isSuperAdmin) redirect("/site");

  return <SiteAccess />;
}
