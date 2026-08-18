"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useShopperStore } from "../lib/use-shopper-store";

export function useShopperSession() {
  return useShopperStore((state) => state.session);
}

export function useShopperSignup() {
  const setSession = useShopperStore((state) => state.setSession);
  return useMutation(
    orpc.shopper.signup.mutationOptions({
      onSuccess: (data) =>
        setSession({
          shopperId: data.shopperId,
          token: data.token,
          name: data.name,
          email: data.email,
        }),
    }),
  );
}

export function useShopperLogin() {
  const setSession = useShopperStore((state) => state.setSession);
  return useMutation(
    orpc.shopper.login.mutationOptions({
      onSuccess: (data) =>
        setSession({
          shopperId: data.shopperId,
          token: data.token,
          name: data.name,
          email: data.email,
        }),
    }),
  );
}

export function useFavoritesList(token: string | undefined) {
  return useQuery({
    ...orpc.shopper.favoritesList.queryOptions({ input: { token } }),
    enabled: Boolean(token),
  });
}

export function useIsFavorite(
  orgSlug: string,
  barcode: string,
  token: string | undefined,
) {
  return useQuery({
    ...orpc.shopper.isFavorite.queryOptions({
      input: { token, orgSlug, barcode },
    }),
    enabled: Boolean(token),
  });
}

export function useFavoriteToggle() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.shopper.favoriteToggle.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.shopper.isFavorite.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.shopper.favoritesList.key(),
        });
      },
    }),
  );
}

export function useProductCoupons(
  orgSlug: string,
  storeId: string,
  barcode: string,
) {
  return useQuery(
    orpc.tradegramPublic.listCoupons.queryOptions({
      input: { orgSlug, storeId, barcode },
    }),
  );
}

export function useRedeemCoupon() {
  return useMutation(orpc.tradegramPublic.redeemCoupon.mutationOptions());
}
