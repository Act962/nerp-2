import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("estoque");
  redirect("/estoque/movimentacoes");
}
