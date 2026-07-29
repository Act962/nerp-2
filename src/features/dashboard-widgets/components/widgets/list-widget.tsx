"use client";

import { formatWidgetValue, type WidgetValue } from "../../lib/widget-value";

export function ListWidget({
  value,
}: {
  value: Extract<WidgetValue, { kind: "LIST" }>;
}) {
  if (value.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nada por aqui ainda.
      </p>
    );
  }

  return (
    <ul className="flex h-full flex-col gap-2 overflow-y-auto">
      {value.items.map((item) => (
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
  );
}
