import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { InventoryDetail } from "@/features/stock/components/inventory-detail";
import { requirePermission } from "@/lib/auth-utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("estoque");
  const { id } = await params;

  return (
    <div className="space-y-6">
      <PageHeader title="Contagem" description="Divergências e aplicação">
        <Button size="sm" variant="outline" asChild>
          <Link href="/estoque/inventarios">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
      </PageHeader>
      <InventoryDetail id={id} />
    </div>
  );
}
