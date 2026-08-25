import { RankingPage } from "@/features/ranking/components/ranking-page";
import { requirePermission } from "@/lib/auth-utils";

export default async function Page() {
  await requirePermission("ranking");
  return (
    <>
      <RankingPage />
    </>
  );
}
