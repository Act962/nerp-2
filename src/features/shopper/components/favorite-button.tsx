"use client";

import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  useFavoriteToggle,
  useIsFavorite,
  useShopperSession,
} from "../hooks/use-shopper-account";

export function FavoriteButton({
  orgSlug,
  storeId,
  barcode,
}: {
  orgSlug: string;
  storeId: string;
  barcode: string;
}) {
  const session = useShopperSession();
  const isFavorite = useIsFavorite(orgSlug, barcode, session?.token);
  const toggle = useFavoriteToggle();

  if (!session) {
    const back = `/tradegram/${orgSlug}/${storeId}/produto/${barcode}`;
    return (
      <Button asChild variant="outline" size="icon" aria-label="Favoritar">
        <Link href={`/tradegram/entrar?redirect=${encodeURIComponent(back)}`}>
          <Heart className="size-5" />
        </Link>
      </Button>
    );
  }

  const favorited = isFavorite.data?.favorited === true;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={favorited ? "Desfavoritar" : "Favoritar"}
      disabled={toggle.isPending}
      onClick={() =>
        toggle.mutate(
          { token: session.token, orgSlug, storeId, barcode },
          { onError: (error) => toast.error(error.message) },
        )
      }
    >
      <Heart
        className={`size-5 ${favorited ? "fill-red-500 text-red-500" : ""}`}
      />
    </Button>
  );
}
