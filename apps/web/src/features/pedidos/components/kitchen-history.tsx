"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { constructUrl } from "@/hooks/use-construct-url";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

const POLL_MS = 10_000;

// Rótulos visíveis para os tipos de evento + cor do badge.
const typeMeta: Record<
  string,
  { label: string; tone: "neutral" | "info" | "success" | "amber" | "muted" }
> = {
  CREATED: { label: "Criado", tone: "neutral" },
  MOVED: { label: "Movido", tone: "info" },
  READY: { label: "Pronto", tone: "success" },
  DELIVERED: { label: "Entregue", tone: "success" },
  ARCHIVED: { label: "Arquivado", tone: "muted" },
  RESTORED: { label: "Restaurado", tone: "info" },
};

const toneClass: Record<string, string> = {
  neutral: "bg-foreground text-background",
  info: "bg-sky-500 text-white",
  success: "bg-emerald-500 text-white",
  amber: "bg-amber-500 text-white",
  muted: "bg-muted text-foreground",
};

export function KitchenHistory() {
  const { data, isLoading } = useQuery(
    orpc.kitchen.events.list.queryOptions({
      input: { limit: 100 },
      refetchInterval: POLL_MS,
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History className="size-6" />
          </EmptyMedia>
          <EmptyTitle>Sem histórico ainda</EmptyTitle>
          <EmptyDescription>
            Cada criação, mudança de coluna ou entrega aparece aqui.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      {data.map((event) => {
        const meta = typeMeta[event.type] ?? {
          label: event.type,
          tone: "muted",
        };
        const when = new Date(event.createdAt);
        const formattedDate = when.toLocaleDateString("pt-BR");
        const formattedTime = when.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const showColumnTransition =
          event.fromColumnName && event.toColumnName;

        return (
          <div
            key={event.id}
            className="flex items-start gap-2 rounded-md border bg-card p-2"
          >
            <Avatar className="size-8 shrink-0">
              {event.actorPhotoUrl && (
                <AvatarImage
                  src={constructUrl(event.actorPhotoUrl)}
                  alt={event.actorName}
                />
              )}
              <AvatarFallback className="text-xs">
                {event.actorName[0]?.toUpperCase() ?? "?"}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge className={cn("text-[10px]", toneClass[meta.tone])}>
                  {meta.label}
                </Badge>
                <span className="text-xs font-semibold">
                  Mesa {event.tableNumber}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  · {event.dishName}
                </span>
              </div>

              {showColumnTransition && (
                <p className="text-[11px] text-muted-foreground">
                  {event.fromColumnName} → {event.toColumnName}
                </p>
              )}
              {!showColumnTransition && event.toColumnName && (
                <p className="text-[11px] text-muted-foreground">
                  Entrou em {event.toColumnName}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>
                  Por <span className="font-medium">{event.actorName}</span>
                  {event.actorType === "WAITER" && " (garçom)"}
                </span>
                {event.attendantName && (
                  <span>· Atendente: {event.attendantName}</span>
                )}
                <span>
                  · {formattedDate} {formattedTime}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
