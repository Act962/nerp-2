"use client";

import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { TradeGramFooter } from "./tradegram-footer";
import { TradeGramGroup } from "./tradegram-group";
import { TradeGramStore } from "./tradegram-store";

/**
 * Despachante de `/tradegram/<slug>`.
 *
 * Custa um ida-e-volta antes do conteúdo — o preço de ter organização e loja no
 * mesmo segmento. A alternativa seria consultar o banco direto na página, mas a
 * convenção do projeto é que página não fala com o Prisma.
 */
export function TradeGramSlugRouter({ slug }: { slug: string }) {
  const { data, isPending } = useQuery(
    orpc.tradegramPublic.resolveSlug.queryOptions({ input: { slug } }),
  );

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (data?.kind === "GROUP" && data.orgSlug) {
    return <TradeGramGroup orgSlug={data.orgSlug} />;
  }

  if (data?.kind === "STORE" && data.orgSlug && data.storeId) {
    return <TradeGramStore orgSlug={data.orgSlug} storeId={data.storeId} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-medium">Não encontramos esta página</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        O endereço pode ter mudado, ou o perfil não está público.
      </p>
      <Link href="/tradegram" className="text-sm underline">
        Voltar ao mapa
      </Link>
      <TradeGramFooter />
    </div>
  );
}
