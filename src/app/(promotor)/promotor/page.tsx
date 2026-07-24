import { PromotorApp } from "@/features/promotor/components/promotor-app";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/auth-utils";
import { headers } from "next/headers";

export default async function PromotorPage() {
  await requirePermission("promotor");
  // Nome do promotor precisa chegar ao client para ser carimbado na foto.
  const session = await auth.api.getSession({ headers: await headers() });
  return <PromotorApp promoterName={session?.user?.name ?? "Promotor"} />;
}
