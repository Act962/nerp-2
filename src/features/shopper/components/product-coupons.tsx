"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Factory, Ticket } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  useProductCoupons,
  useRedeemCoupon,
  useShopperSession,
} from "../hooks/use-shopper-account";

function discountLabel(type: "PERCENT" | "FIXED", value: number) {
  return type === "PERCENT"
    ? `${value}% OFF`
    : `- ${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
}

export function ProductCoupons({
  orgSlug,
  storeId,
  barcode,
}: {
  orgSlug: string;
  storeId: string;
  barcode: string;
}) {
  const session = useShopperSession();
  const { data } = useProductCoupons(orgSlug, storeId, barcode);
  const redeem = useRedeemCoupon();
  const coupons = data?.coupons ?? [];
  if (coupons.length === 0) return null;

  const back = `/tradegram/${orgSlug}/${storeId}/produto/${barcode}`;

  return (
    <div className="space-y-2">
      <h2 className="flex items-center gap-2 font-medium text-sm">
        <Ticket className="size-4" /> Cupons
      </h2>
      {coupons.map((coupon) => (
        <div
          key={coupon.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">
                {discountLabel(coupon.type, coupon.value)}
              </span>
              {coupon.sponsored && (
                <Badge variant="outline" className="gap-1">
                  <Factory className="size-3" /> Indústria
                </Badge>
              )}
            </div>
            <p className="truncate text-muted-foreground text-sm">
              {coupon.title}
            </p>
          </div>
          {session ? (
            <Button
              type="button"
              size="sm"
              disabled={redeem.isPending}
              onClick={() =>
                redeem.mutate(
                  {
                    token: session.token,
                    orgSlug,
                    storeId,
                    couponId: coupon.id,
                  },
                  {
                    onSuccess: (result) =>
                      toast.success(`Cupom garantido! Código: ${result.code}`),
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              Resgatar
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link
                href={`/tradegram/entrar?redirect=${encodeURIComponent(back)}`}
              >
                Entrar
              </Link>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
