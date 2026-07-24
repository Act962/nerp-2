import { PlanogramNav } from "@/features/planogram/components/planogram-nav";
import { requirePermission } from "@/lib/auth-utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Layout de rota e não Tabs: o editor persiste ao trocar de aba irmã, porque o
// layout não é remontado. Com Tabs dentro do componente, o Stage do Konva
// desmontaria a cada clique e o usuário perderia zoom, seleção e histórico.
export default async function PlanogramLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ planogramId: string }>;
}) {
  await requirePermission("planograma");
  const { planogramId } = await params;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link href="/trade/planograma" aria-label="Voltar para planogramas">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <PlanogramNav planogramId={planogramId} />
      </div>
      {children}
    </div>
  );
}
