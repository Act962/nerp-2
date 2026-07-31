import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AddStoreButton } from "@/features/stores/components/add-store-button";
import { ListStores } from "@/features/stores/components/list-stores";
import { TradeMarketingOverview } from "@/features/stores/components/trade-marketing-overview";
import { requirePermission } from "@/lib/auth-utils";
import { UploadIcon } from "lucide-react";
import Link from "next/link";

export default async function LojasPage() {
  await requirePermission("lojas");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lojas e Mapas"
        description="Cadastre lojas, desenhe a planta baixa e mapeie os PDVs"
      >
        <Button variant="outline" asChild>
          <Link href="/lojas/importar">
            <UploadIcon className="size-4" />
            Importar
          </Link>
        </Button>
        <AddStoreButton />
      </PageHeader>
      <TradeMarketingOverview />
      <ListStores />
    </div>
  );
}
