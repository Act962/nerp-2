"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatWidgetValue, type WidgetValue } from "../../lib/widget-value";

const DEFAULT_PAGE_SIZE = 10;

export function ListWidget({
  value,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  value: Extract<WidgetValue, { kind: "LIST" }>;
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);

  if (value.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nada por aqui ainda.
      </p>
    );
  }

  const totalItems = value.items.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const hasPagination = totalPages > 1;
  const start = page * pageSize;
  const pageItems = value.items.slice(start, start + pageSize);

  return (
    <div className="flex h-full flex-col">
      <ul className="flex min-h-0 flex-1 flex-col gap-2">
        {pageItems.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            {item.rank !== undefined && (
              <span className="w-5 shrink-0 text-center font-bold text-muted-foreground">
                {item.rank}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.meta && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.meta}
              </span>
            )}
            <span className="shrink-0 font-semibold tabular-nums">
              {formatWidgetValue(item.value, item.unit)}
            </span>
          </li>
        ))}
      </ul>

      {hasPagination && (
        <div className="flex shrink-0 items-center justify-between border-t px-1 py-1">
          <button
            type="button"
            disabled={page === 0}
            onClick={(e) => {
              e.stopPropagation();
              setPage((p) => Math.max(0, p - 1));
            }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {start + 1}–{Math.min(start + pageSize, totalItems)} de {totalItems}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={(e) => {
              e.stopPropagation();
              setPage((p) => Math.min(totalPages - 1, p + 1));
            }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
