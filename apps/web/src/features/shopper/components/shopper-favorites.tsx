"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { constructUrl } from "@/hooks/use-construct-url";
import { ChevronLeft, Heart, Package } from "lucide-react";
import Link from "next/link";
import {
  useFavoritesList,
  useShopperSession,
} from "../hooks/use-shopper-account";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface FavoriteItem {
  id: string;
  barcode: string | null;
  name: string;
  thumbnail: string | null;
  orgSlug: string;
  storeId: string | null;
  price: number;
  dropPct: number | null;
}

function FavoriteRow({ favorite }: { favorite: FavoriteItem }) {
  const href =
    favorite.barcode && favorite.storeId
      ? `/tradegram/${favorite.orgSlug}/${favorite.storeId}/produto/${favorite.barcode}`
      : null;

  const content = (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {favorite.thumbnail ? (
          // biome-ignore lint/performance/noImgElement: key R2
          <img
            src={constructUrl(favorite.thumbnail)}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <Package className="size-5 text-muted-foreground" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{favorite.name}</p>
        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">
            {formatBRL(favorite.price)}
          </span>
          {favorite.dropPct ? (
            <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700">
              ↓ {favorite.dropPct}%
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

export function ShopperFavorites() {
  const session = useShopperSession();
  const { data, isLoading } = useFavoritesList(session?.token);

  if (!session) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <Heart className="size-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Seus favoritos ficam aqui</p>
          <p className="text-muted-foreground text-sm">
            Entre para favoritar produtos e receber alertas de preço.
          </p>
        </div>
        <Button asChild>
          <Link href="/tradegram/entrar?redirect=/tradegram/favoritos">
            Entrar
          </Link>
        </Button>
      </div>
    );
  }

  const favorites = data ?? [];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center gap-2">
        <Link
          href="/tradegram/buscar"
          className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> TradeGram
        </Link>
      </header>

      <h1 className="flex items-center gap-2 font-semibold text-xl">
        <Heart className="size-5" /> Meus favoritos
      </h1>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : favorites.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground text-sm">
          Você ainda não favoritou nenhum produto.
        </p>
      ) : (
        <div className="space-y-2">
          {favorites.map((favorite) => (
            <FavoriteRow key={favorite.id} favorite={favorite} />
          ))}
        </div>
      )}
    </div>
  );
}
