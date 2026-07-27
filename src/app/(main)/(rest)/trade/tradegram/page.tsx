import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicProfileCard } from "@/features/tradegram/components/public-profile-card";
import { requirePermission } from "@/lib/auth-utils";
import Link from "next/link";

// Área de configuração do app público TradeGram.
export default async function TradeGramConfigPage() {
  await requirePermission("tradegram");

  return (
    <div className="space-y-6">
      <PageHeader
        title="TradeGram"
        description="Vitrine pública das suas lojas e mapas de PDV, no estilo de um feed."
      />

      <PublicProfileCard />

      <Card>
        <CardHeader>
          <CardTitle>Fotos das lojas</CardTitle>
          <CardDescription>
            Cada unidade aparece no feed com a foto de fachada cadastrada.
            Defina a imagem em cada loja para a vitrine ficar completa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/lojas"
            className="text-primary text-sm underline underline-offset-4"
          >
            Ir para Lojas e Mapas
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
