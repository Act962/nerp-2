import { constructUrl } from "@/hooks/use-construct-url";
import {
  BadgeCheck,
  CircleDot,
  CircleSlash,
  LayoutGrid,
  Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";

export interface MediaTileData {
  code: string;
  name: string;
  photoKey: string | null;
  countA: number;
  countB: number;
  // Tem pelo menos um espaço com contrato ativo (executado).
  active: boolean;
}

interface MediaTileProps {
  orgSlug: string;
  storeId: string;
  tile: MediaTileData;
}

// Quadro de um tipo de mídia na página da loja. Clicar abre a página de detalhe
// da mídia (fotos de cada espaço daquele tipo na loja).
export function MediaTile({ orgSlug, storeId, tile }: MediaTileProps) {
  return (
    <Link
      href={`/tradegram/${orgSlug}/${storeId}/midia/${encodeURIComponent(tile.code)}`}
      className="group relative block aspect-square overflow-hidden rounded-md bg-muted"
    >
      {tile.photoKey ? (
        // biome-ignore lint/performance/noImgElement: foto por key do R2
        <img
          src={constructUrl(tile.photoKey)}
          alt={tile.name}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
          <ImageIcon className="size-8 text-white/40" />
        </div>
      )}

      {tile.active ? (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 font-medium text-[11px] text-white">
          <CircleDot className="size-3" /> Ativo
        </span>
      ) : (
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 font-medium text-[11px] text-white/90">
          <CircleSlash className="size-3" /> Inativo
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <span className="block truncate font-semibold text-sm text-white">
              {tile.name}
            </span>
            <span className="text-white/70 text-xs">{tile.code}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-white text-xs">
            <span className="flex items-center gap-1">
              <BadgeCheck className="size-3 text-emerald-400" />
              {tile.countA}
            </span>
            <span className="flex items-center gap-1">
              <LayoutGrid className="size-3 text-cyan-400" />
              {tile.countB}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
