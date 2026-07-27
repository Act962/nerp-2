"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Clock,
  Handshake,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
} from "lucide-react";
import { useState } from "react";
import {
  useTradeInterests,
  useUpdateTradeInterestStatus,
} from "../hooks/use-trade-interest";

type InterestStatus = "NOVO" | "EM_CONTATO" | "GANHO" | "ARQUIVADO";

const STATUS_OPTIONS: { value: InterestStatus; label: string }[] = [
  { value: "NOVO", label: "Novo" },
  { value: "EM_CONTATO", label: "Em contato" },
  { value: "GANHO", label: "Ganho" },
  { value: "ARQUIVADO", label: "Arquivado" },
];

const STATUS_BADGE: Record<InterestStatus, string> = {
  NOVO: "border-cyan-300 bg-cyan-50 text-cyan-700",
  EM_CONTATO: "border-amber-300 bg-amber-50 text-amber-700",
  GANHO: "border-emerald-300 bg-emerald-50 text-emerald-700",
  ARQUIVADO: "border-muted bg-muted text-muted-foreground",
};

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TradeInterestsInbox() {
  const [tab, setTab] = useState<"ALL" | InterestStatus>("ALL");
  const { data, isLoading } = useTradeInterests({
    status: tab === "ALL" ? undefined : tab,
  });
  const updateStatus = useUpdateTradeInterestStatus();
  const counts = data?.counts;
  const interests = data?.interests ?? [];

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="ALL">Todos ({counts?.total ?? 0})</TabsTrigger>
          <TabsTrigger value="NOVO">Novos ({counts?.novo ?? 0})</TabsTrigger>
          <TabsTrigger value="EM_CONTATO">
            Em contato ({counts?.emContato ?? 0})
          </TabsTrigger>
          <TabsTrigger value="GANHO">Ganhos ({counts?.ganho ?? 0})</TabsTrigger>
          <TabsTrigger value="ARQUIVADO">
            Arquivados ({counts?.arquivado ?? 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : interests.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
          Nenhum lead por aqui ainda. Quando alguém demonstrar interesse por um
          ponto no TradeGram público, ele aparece nesta caixa.
        </div>
      ) : (
        <div className="space-y-3">
          {interests.map((interest) => (
            <Card key={interest.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{interest.name}</p>
                      {interest.company && (
                        <span className="truncate text-muted-foreground text-sm">
                          · {interest.company}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(interest.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="gap-1 whitespace-nowrap"
                    >
                      {interest.kind === "INTERESSE" ? (
                        <>
                          <Handshake className="size-3" /> Interesse
                        </>
                      ) : (
                        <>
                          <Clock className="size-3" /> Fila de espera
                        </>
                      )}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`whitespace-nowrap ${STATUS_BADGE[interest.status]}`}
                    >
                      {STATUS_OPTIONS.find(
                        (option) => option.value === interest.status,
                      )?.label ?? interest.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {interest.store.name}
                    {interest.spaceLabel ? ` · ${interest.spaceLabel}` : ""}
                    {interest.spaceCode ? ` (${interest.spaceCode})` : ""}
                  </span>
                  {interest.email && (
                    <a
                      href={`mailto:${interest.email}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <Mail className="size-3.5" /> {interest.email}
                    </a>
                  )}
                  {interest.phone && (
                    <a
                      href={`tel:${interest.phone}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <Phone className="size-3.5" /> {interest.phone}
                    </a>
                  )}
                </div>

                {interest.message && (
                  <p className="flex items-start gap-1.5 rounded-md bg-muted/40 p-2 text-sm">
                    <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    {interest.message}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <span className="text-muted-foreground text-xs">Status</span>
                  <Select
                    value={interest.status}
                    onValueChange={(value) =>
                      updateStatus.mutate({
                        id: interest.id,
                        status: value as InterestStatus,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
