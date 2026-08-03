"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import { Building2, MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePublicCompany } from "../hooks/use-tradegram";
import { TradeGramFooter } from "./tradegram-footer";

const TradeGramGeoMap = dynamic(
  () => import("./tradegram-geo-map").then((mod) => mod.TradeGramGeoMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-lg border">
        <Spinner />
      </div>
    ),
  },
);

const TYPE_LABEL = {
  SUPERMERCADO: "Varejo",
  INDUSTRIA: "Indústria",
  DISTRIBUIDOR: "Distribuidor",
} as const;

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Perfil público de uma empresa do catálogo.
 *
 * Existe para fechar o funil: a pessoa acha a própria empresa na busca, vê a
 * rede dela desenhada no mapa, e o caminho para reivindicar está ali. Sem esta
 * página, o catálogo é uma lista que não leva a lugar nenhum.
 */
export function TradeGramCompany({ companyId }: { companyId: string }) {
  const { data, isPending, isError } = usePublicCompany(companyId);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-medium">Não encontramos esta empresa</p>
        <Link href="/tradegram" className="text-sm underline">
          Voltar ao mapa
        </Link>
      </div>
    );
  }

  const { header, owner, network, points } = data;
  const logo = header.logoKey ? constructUrl(header.logoKey) : null;
  const place = [header.city, header.state].filter(Boolean).join(" / ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
          {logo ? (
            // biome-ignore lint/performance/noImgElement: logo do catálogo (R2 ou asset)
            <img src={logo} alt="" className="size-full object-cover" />
          ) : (
            <Building2 className="size-7 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{header.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{TYPE_LABEL[header.type]}</Badge>
            {place}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat value={network.pdvs} label="pontos de venda" />
        <Stat value={network.mapped} label="no mapa" />
        <Stat value={network.cities} label="cidades" />
      </div>

      {/* Reivindicar é o próximo passo de quem se reconheceu aqui. */}
      {!owner.isClaimed && (
        <div className="mt-4 rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm font-medium">É a sua empresa?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Reivindique o perfil e administre a presença da sua rede no
            TradeGram.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href={`/tradegram/entrar?claim=${companyId}`}>
              Reivindicar esta empresa
            </Link>
          </Button>
        </div>
      )}

      {owner.isClaimed && owner.orgSlug && (
        <div className="mt-4 flex items-center justify-between rounded-lg border p-3">
          <p className="text-sm">
            Perfil administrado por{" "}
            <strong className="font-medium">{owner.orgName}</strong>
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/tradegram/${owner.orgSlug}`}>Ver perfil</Link>
          </Button>
        </div>
      )}

      {points.length > 0 ? (
        <div className="mt-4">
          <TradeGramGeoMap
            className="h-72 w-full rounded-lg border sm:h-96"
            points={points.map((point) => ({
              kind: "DIRECTORY" as const,
              id: point.id,
              name: point.name,
              latitude: point.latitude,
              longitude: point.longitude,
              city: point.city,
              state: point.state,
              address: null,
              logoKey: header.logoKey,
              path: null,
            }))}
          />
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg border p-4 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {network.pdvs > 0
            ? "As lojas desta rede ainda não têm posição no mapa — o pino é fixado na primeira visita de um promotor."
            : "Nenhuma loja cadastrada para esta empresa ainda."}
        </p>
      )}

      <TradeGramFooter />
    </div>
  );
}
