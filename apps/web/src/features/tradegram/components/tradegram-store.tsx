"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Camera, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePublicStore } from "../hooks/use-tradegram";
import { MediaTile } from "./media-tile";
import { TradeGramFooter } from "./tradegram-footer";
import { TradeGramHeader } from "./tradegram-header";

const ALL = "__all__";

interface Props {
  orgSlug: string;
  storeId: string;
}

export function TradeGramStore({ orgSlug, storeId }: Props) {
  const { data, isPending, isError } = usePublicStore(orgSlug, storeId);
  const [mediaCode, setMediaCode] = useState<string>(ALL);

  const tiles = useMemo(() => {
    if (!data) return [];
    if (mediaCode === ALL) return data.mediaTiles;
    return data.mediaTiles.filter((tile) => tile.code === mediaCode);
  }, [data, mediaCode]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-muted-foreground">
        Loja não encontrada.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          href={`/tradegram/${orgSlug}`}
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Grupo
        </Link>
        <Link
          href={`/promotor?storeId=${storeId}`}
          title="Registrar foto no PDV (promotor)"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm shadow-sm hover:opacity-90"
        >
          <Camera className="size-4" /> Foto
        </Link>
      </div>

      <TradeGramHeader
        name={data.header.name}
        handle={data.header.handle}
        subtitle={[data.header.city, data.header.state]
          .filter(Boolean)
          .join(" / ")}
        stats={[
          {
            value: data.stats.negociados,
            label: "prateleiras negociadas",
            tone: "positive",
          },
          {
            value: data.stats.naoNegociados,
            label: "disponíveis",
            tone: "negative",
          },
          { value: data.stats.industrias, label: "Indústrias" },
        ]}
      />

      <div className="px-4 pb-4">
        <Select value={mediaCode} onValueChange={setMediaCode}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o tipo de mídia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos de mídia</SelectItem>
            {data.mediaTiles.map((tile) => (
              <SelectItem key={tile.code} value={tile.code}>
                {tile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tiles.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground text-sm">
          Nenhuma mídia cadastrada nesta loja.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3">
          {tiles.map((tile) => (
            <MediaTile
              key={tile.code}
              orgSlug={orgSlug}
              storeId={storeId}
              tile={tile}
            />
          ))}
        </div>
      )}

      <TradeGramFooter />
    </div>
  );
}
