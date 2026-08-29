"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function useCreateScannerPairing() {
  return useMutation(
    orpc.scanner.createPairing.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

export function useRevokeScannerPairing() {
  return useMutation(
    orpc.scanner.revoke.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );
}

/** Estado do pareamento na tela do PDV: já abriu? continua vivo? */
export function useScannerStatus(token: string | null) {
  return useQuery(
    orpc.scanner.status.queryOptions({
      input: { token: token ?? "" },
      enabled: Boolean(token),
      refetchInterval: 2000,
    }),
  );
}

export function useClaimScannerPairing() {
  return useMutation(orpc.scanner.claim.mutationOptions({}));
}

export function usePushScannerScan() {
  return useMutation(orpc.scanner.push.mutationOptions({}));
}

/**
 * Assina o fluxo de códigos lidos no celular.
 *
 * `EventSource` e não polling: a latência é o requisito do recurso — um leitor
 * que demora meio segundo perde para o de balcão. O callback fica num ref para
 * a conexão não ser derrubada e refeita a cada render do PDV.
 */
export function useScannerStream(
  token: string | null,
  onScan: (code: string) => void,
): void {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!token) return;
    const source = new EventSource(
      `/api/scanner/stream?token=${encodeURIComponent(token)}`,
    );

    const handleScan = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { code?: string };
        if (data.code) onScanRef.current(data.code);
      } catch {
        // Evento malformado não pode derrubar o leitor inteiro.
      }
    };

    source.addEventListener("scan", handleScan as EventListener);
    return () => {
      source.removeEventListener("scan", handleScan as EventListener);
      source.close();
    };
  }, [token]);
}
