"use client";

import { useEffect, useRef } from "react";

/**
 * Observa uma sentinela no fim da lista e chama `fetchNextPage` quando ela
 * entra na viewport — funciona tanto em scroll de página quanto dentro de um
 * container com `overflow-y-auto` (ex.: CommandList do cmdk), já que o
 * IntersectionObserver considera o clipping de ancestrais roláveis mesmo com
 * `root: null`.
 */
export function useInfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      { rootMargin: "200px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return sentinelRef;
}
