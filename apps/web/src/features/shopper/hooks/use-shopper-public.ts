"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";

const BARCODE_RE = /^\d{8,}$/;

export function isValidBarcode(barcode: string): boolean {
  return BARCODE_RE.test(barcode.trim());
}

export function useLookupBarcode(
  orgSlug: string,
  storeId: string,
  barcode: string,
) {
  return useQuery({
    ...orpc.tradegramPublic.lookupBarcode.queryOptions({
      input: { orgSlug, storeId, barcode },
    }),
    enabled: isValidBarcode(barcode),
    staleTime: 60_000,
  });
}

export function useLocateProduct(
  orgSlug: string,
  storeId: string,
  barcode: string,
  enabled: boolean,
) {
  return useQuery({
    ...orpc.tradegramPublic.locateProduct.queryOptions({
      input: { orgSlug, storeId, barcode },
    }),
    enabled: enabled && isValidBarcode(barcode),
    staleTime: 60_000,
  });
}

export function useLogScan() {
  return useMutation(orpc.tradegramPublic.logScan.mutationOptions());
}

export function useIdentifyProduct() {
  return useMutation(orpc.tradegramPublic.identifyProduct.mutationOptions());
}
