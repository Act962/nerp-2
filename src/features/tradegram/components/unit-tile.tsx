import { constructUrl } from "@/hooks/use-construct-url";
import { BadgeCheck, LayoutGrid, Store } from "lucide-react";
import Link from "next/link";

export interface UnitTileData {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  coverImageKey: string | null;
  statA: number;
  statB: number;
}

interface UnitTileProps {
  orgSlug: string;
  groupName: string;
  logoKey?: string | null;
  store: UnitTileData;
}

// Quadro de uma unidade no feed do grupo. Clicar abre a página da loja.
export function UnitTile({
  orgSlug,
  groupName,
  logoKey,
  store,
}: UnitTileProps) {
  const location = [store.city, store.state].filter(Boolean).join(" / ");

  return (
    <Link
      href={`/tradegram/${orgSlug}/${store.id}`}
      className="group relative block aspect-square overflow-hidden rounded-md bg-muted"
    >
      {store.coverImageKey ? (
        // biome-ignore lint/performance/noImgElement: foto por key do R2
        <img
          src={constructUrl(store.coverImageKey)}
          alt={store.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
          <Store className="size-10 text-white/40" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {logoKey ? (
                // biome-ignore lint/performance/noImgElement: logo por key do R2
                <img
                  src={constructUrl(logoKey)}
                  alt={groupName}
                  className="size-4 rounded-full object-cover"
                />
              ) : null}
              <span className="truncate font-semibold text-sm text-white">
                {store.name}
              </span>
            </div>
            {location && (
              <span className="truncate text-white/80 text-xs">{location}</span>
            )}
          </div>
          <div className="flex flex-col items-end gap-0.5 text-white text-xs">
            <span className="flex items-center gap-1">
              <LayoutGrid className="size-3 text-cyan-400" />
              {store.statA.toLocaleString("pt-BR")}
            </span>
            <span className="flex items-center gap-1">
              <BadgeCheck className="size-3 text-emerald-400" />
              {store.statB.toLocaleString("pt-BR")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
