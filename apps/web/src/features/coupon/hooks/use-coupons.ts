"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useCoupons() {
  return useQuery(orpc.coupon.list.queryOptions({ input: {} }));
}

function useInvalidateCoupons() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: orpc.coupon.list.key() });
}

export function useCreateCoupon() {
  const invalidate = useInvalidateCoupons();
  return useMutation(
    orpc.coupon.create.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useDeleteCoupon() {
  const invalidate = useInvalidateCoupons();
  return useMutation(
    orpc.coupon.delete.mutationOptions({ onSuccess: invalidate }),
  );
}
