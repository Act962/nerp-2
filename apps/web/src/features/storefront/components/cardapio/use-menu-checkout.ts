"use client";

import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMenuCheckout() {
  return useMutation(
    orpc.checkout.menuCheckout.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}
