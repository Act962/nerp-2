"use client";

import { Spinner } from "@/components/ui/spinner";
import { constructUrl } from "@/hooks/use-construct-url";
import {
  Camera,
  ChevronLeft,
  CircleDot,
  CircleSlash,
  Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { usePublicStoreMedia } from "../hooks/use-tradegram";
import { TradeGramFooter } from "./tradegram-footer";

interface Props {
  orgSlug: string;
  storeId: string;
  mediaCode: string;
}

// Deep-link para o app de captura, já com a loja e (quando houver) a indústria
// daquele espaço pré-selecionadas.
function promotorHref(storeId: string, supplierId?: string | null) {
  const params = new URLSearchParams({ storeId });
  if (supplierId) params.set("supplierId", supplierId);
  return `/promotor?${params.toString()}`;
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 text-xs">
      <CircleDot className="size-3" /> Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
      <CircleSlash className="size-3" /> Inativo
    </span>
  );
}

export function TradeGramMediaDetail({ orgSlug, storeId, mediaCode }: Props) {
  const { data, isPending, isError } = usePublicStoreMedia(
    orgSlug,
    storeId,
    mediaCode,
  );

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
        Mídia não encontrada.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <div className="flex items-center justify-between px-4 pt-4">
        <Link
          href={`/tradegram/${orgSlug}/${storeId}`}
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {data.storeName}
        </Link>
        <Link
          href={promotorHref(storeId)}
          title="Registrar foto no PDV (promotor)"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm shadow-sm hover:opacity-90"
        >
          <Camera className="size-4" /> Foto
        </Link>
      </div>

      <div className="px-4 py-4">
        <h1 className="font-semibold text-2xl">{data.media.name}</h1>
        <p className="text-muted-foreground text-sm">
          {data.instances.length}{" "}
          {data.instances.length === 1 ? "espaço" : "espaços"} nesta loja
        </p>
      </div>

      {data.instances.length === 0 ? (
        <p className="px-4 py-12 text-center text-muted-foreground text-sm">
          Nenhum espaço deste tipo cadastrado nesta loja.
        </p>
      ) : (
        <div className="space-y-4 px-4">
          {data.instances.map((instance) => (
            <section key={instance.id} className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{instance.label}</span>
                  <ActiveBadge active={instance.active} />
                  {instance.supplier && (
                    <span className="truncate text-muted-foreground text-sm">
                      · {instance.supplier.name}
                    </span>
                  )}
                </div>
                <Link
                  href={promotorHref(storeId, instance.supplier?.id)}
                  title="Registrar foto desta mídia"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Camera className="size-4" />
                </Link>
              </div>

              {instance.photos.length === 0 ? (
                <div className="flex h-28 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <ImageIcon className="size-6" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {instance.photos.map((photoKey) => (
                    // biome-ignore lint/performance/noImgElement: foto por key do R2
                    <img
                      key={photoKey}
                      src={constructUrl(photoKey)}
                      alt={instance.label}
                      loading="lazy"
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <TradeGramFooter />
    </div>
  );
}
