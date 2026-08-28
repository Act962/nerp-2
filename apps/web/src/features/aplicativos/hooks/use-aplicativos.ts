"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

// O manifesto vem do bucket, não do banco: um release publicado enquanto a aba
// está aberta aparece na próxima janela de 5 min (mesmo horizonte do cache do
// servidor). Sem polling — o usuário não fica olhando esta tela esperando.
const STALE_MS = 5 * 60_000;

export function useLatestDesktopRelease() {
  return useQuery(
    orpc.desktopRelease.latest.queryOptions({
      input: {},
      staleTime: STALE_MS,
    }),
  );
}
